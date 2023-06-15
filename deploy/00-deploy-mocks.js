const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
// const ethers = require("ethers");
// const hardhat = require("hardhat");
const { ethers } = require("hardhat");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  const BASE_FEE = ethers.utils.parseEther("0.25"); // amt paid by us for each request for random no
  const GAS_PRICE_FEE = 1e9; // gas fee paid by chainlink node to execute keepup and performupkeep fns, so it is link per gas
  const args = [BASE_FEE, GAS_PRICE_FEE];

  if (developmentChains.includes(network.name)) {
    console.log("Local network detected!!!");
  }

  await deploy("VRFCoordinatorV2Mock", {
    from: deployer,
    args: args,
    log: log,
  });

  console.log("Mocks deployed");
  console.log(
    "-----------------------------------------------------------------"
  );
};

module.exports.tags = ["all", "mocks"];
