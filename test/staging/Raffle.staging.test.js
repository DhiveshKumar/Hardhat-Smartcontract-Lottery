const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("raffle Test Units", () => {
      let raffle, deployer, raffleEntranceFee;

      beforeEach(async () => {
        // deploy all contracts and get them
        deployer = (await getNamedAccounts()).deployer;
        raffle = await ethers.getContract("Raffle", deployer);

        raffleEntranceFee = await raffle.getEntranceFee();
      });

      describe("fulFillRandomWords", () => {
        it("works with chainlink keepers and chainlink vrf and gets a rabdom winner", async () => {
          console.log("Setting up test");
          const startingTimeStamp = await raffle.getLastTimeStamp();
          const accounts = await ethers.getSigners();

          console.log("Setting up Listener...");
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("Winner Picked event fired!");

              try {
                const raffleState = await raffle.getRaffleState();
                const recentWinner = await raffle.getRecentWinner();
                const winnerEndBalance = await accounts[0].getBalance();
                const endingTimeStamp = await raffle.getLastTimeStamp();
                // asserts
                expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(raffleState.toString(), "0");
                assert.equal(
                  winnerEndBalance.toString(),
                  winnerStartBalance.add(raffleEntranceFee).toString()
                );
                assert(endingTimeStamp > startingTimeStamp);
                resolve();
              } catch (error) {
                reject(error);
              }
            });

            //   entering raffle after setting up listener
            console.log("Entering Raffle------");
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            await tx.wait(1);
            console.log("Getting winners start balance.........");
            const winnerStartBalance = await accounts[0].getBalance();
            console.log("winnerStartBal: ", winnerStartBalance);
          });
        });
      });
    });
