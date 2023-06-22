const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("raffle Test Units", () => {
      let vrfCoordinatorV2Mock,
        raffle,
        deployer,
        timeInterval,
        raffleEntranceFee;
      const chainId = network.config.chainId;

      beforeEach(async () => {
        // deploy all contracts and get them
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        raffleEntranceFee = await raffle.getEntranceFee();
        timeInterval = await raffle.getTimeInterval();
      });

      //for constructor fn
      describe("constructor", () => {
        it("checks the initial state of raffle", async () => {
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0"); //as we get big nos we convert them into strings
        });

        it("checks for the time interval", async () => {
          assert.equal(
            timeInterval.toString(),
            networkConfig[chainId]["interval"]
          );
        });
      });

      // for enterRaffle fn
      describe("enterRaffle", () => {
        it("reverts if there isn't enough entrance fee", async () => {
          expect(raffle.enterRaffle()).to.be.revertedWith(
            "Raffle__NotEnoughEntranceFee"
          );
        });

        it("checks if player has entered", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer);
        });

        it("checks if the event is emitted", async () => {
          expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
            raffle,
            "RaffleEnter"
          );
        });

        it("checks if it reverts NOT_OPENED error", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });

          // increasing bc time to 31(as interval is 30)
          await network.provider.send("evm_increaseTime", [
            timeInterval.toNumber() + 1,
          ]);

          // mining a block
          await network.provider.send("evm_mine", []);
          expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWith("Raffle__NotOpened");
        });

        it("checks if the checkUpKeep returns false if the user hasn't sent any eth", async () => {
          await network.provider.send("evm_increaseTime", [
            timeInterval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upKeepNeeded);
        });

        it("returns false if raffle isn't open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            timeInterval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await raffle.performUpkeep([]);
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if the time interval hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            timeInterval.toNumber() - 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upKeepNeeded);
        });

        it("returns true if enough time has passes, has enough players, eth and is open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            timeInterval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(upkeepNeeded);
          // assert.equal(upkeepNeeded, false);
        });

        it("performs upkeep when upkeepNeede is true", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            timeInterval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const tx = await raffle.performUpkeep([]);
          assert(tx);
        });

        it("reverts error if upkeepNeeded is false", async () => {
          expect(raffle.performUpkeep([])).to.be.revertedWith(
            "Raffle__UpKeepNotNeeded"
          );
        });

        it("updates raffle state, emits an event and calls vrfCoordinator", async () => {
          const entranceFee = await raffle.getEntranceFee();
          await raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            timeInterval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);

          const txResponse = await raffle.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const raffleState = await raffle.getRaffleState();
          assert(requestId.toNumber() > 0);
          assert.equal(raffleState.toString(), "1");
        });

        describe("fulfillRandomWords", () => {
          beforeEach(async () => {
            await raffle.enterRaffle({ value: raffleEntranceFee });
            await network.provider.send("evm_increaseTime", [
              timeInterval.toNumber() + 1,
            ]);
            await network.provider.send("evm_mine", []);
          });

          it("fulfillRandomWords is performed only if performUpkeep is performed", async () => {
            expect(
              vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
            ).to.be.revertedWith("nonexistent request");
            expect(
              vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
            ).to.be.revertedWith("nonexistent request");
          });

          it("picks a winner, resets lottery and sends money", async () => {
            const additionalPlayers = 3;
            const startingIndex = 1; //as deployer is at 0
            const accounts = await ethers.getSigners();
            4;

            for (
              i = startingIndex;
              i < additionalPlayers + startingIndex;
              i++
            ) {
              const accountConnectedRaffle = raffle.connect(accounts[i]);
              await accountConnectedRaffle.enterRaffle({
                value: raffleEntranceFee,
              });
            }

            const startingTimeStamp = await raffle.getLastTimeStamp();

            await new Promise(async (resolve, reject) => {
              raffle.once("WinnerPicked", async () => {
                console.log("Winner Picked Event Happend!");

                try {
                  const recentWinner = await raffle.getRecentWinner();
                  const raffleState = await raffle.getRaffleState();
                  const endingTimeStamp = await raffle.getLastTimeStamp();
                  const numPlayers = await raffle.getNoPlayers();
                  const winnerEndBalance = await accounts[1].getBalance();
                  assert.equal(numPlayers.toString(), "0");
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(
                    winnerEndBalance.toString(),
                    winnerStartBalance
                      .add(raffleEntranceFee.mul(additionalPlayers))
                      .add(raffleEntranceFee)
                      .toString()
                  );

                  // assert(endingTimeStamp > startingTimeStamp);

                  console.log("Recent WiNNER:", recentWinner);
                  console.log(accounts[0].address);
                  console.log(accounts[1].address);
                  console.log(accounts[2].address);
                  console.log(accounts[3].address);
                } catch (e) {
                  reject(e);
                }
                resolve();
              });

              const transactionResponse = await raffle.performUpkeep([]);
              const transactionReceipt = await transactionResponse.wait(1);
              const requestId = transactionReceipt.events[1].args.requestId;
              const winnerStartBalance = await accounts[1].getBalance();
              console.log("REQUESTID:", requestId);
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                requestId,
                raffle.address
              );
            });
          });
        });
      });
    });
