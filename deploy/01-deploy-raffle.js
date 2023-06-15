const { network, getNamedAccounts, ethers } = require("hardhat");
// const ethers = require("ethers");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");

const { verify } = require("../helper-hardhat-config");

module.exports = async ({ namedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2MockAddress, subscriptionId, VRFCoordinatorV2Mock;
  const VRF_SUBSCRIPTION_AMOUNT = ethers.utils.parseEther("2");

  if (developmentChains.includes(network.name)) {
    VRFCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock");
    vrfCoordinatorV2MockAddress = VRFCoordinatorV2Mock.address;
    // creating subscription and funding that sunbscription
    const transactionResponse = await VRFCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    subscriptionId = transactionReceipt.events[0].args.subId;
    // funding
    await VRFCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      VRF_SUBSCRIPTION_AMOUNT
    );
  } else {
    vrfCoordinatorV2MockAddress = networkConfig[chainId]["vrfCoordinatorV2"];
    // subscription id
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  //entrance fee
  const entranceFee = networkConfig[chainId]["entranceFee"];
  // gas lane
  const gasLane = networkConfig[chainId]["gasLane"];
  //callback gas limit
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  //interval
  const interval = networkConfig[chainId]["interval"];

  const args = [
    vrfCoordinatorV2MockAddress,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];
  console.log("ARGS:", entranceFee);

  // const raffle = await deploy("Raffle", {
  //   from: deployer,
  //   args: args,
  //   log: true,
  //   waitConfirmations: network.config.blockConfirmations || 1,
  // });

  // verifying the raffle contract
  if (!developmentChains.includes(network.name)) {
    // await verify(raffle.address, args);
    console.log("------------------Raffle Verified-------------------------");
  }
};

module.exports.tags = ["all", "raffle"];
