// SPDX-License-Identifier:MIT

pragma solidity ^0.8.7;
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughEntranceFee();
error Raffle__TransferFailed();
error Raffle__NotOpened();
error Raffle__UpKeepNotNeeded(
    uint256 currentBalance,
    uint256 players,
    uint256 raffleState
);

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    // state variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    uint256 private s_prevTimeStamp;
    // ref for coordinator contract
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint256 private immutable i_timeInterval;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    RaffleState private s_raffleState;

    // lottery variables
    address private s_recentWinner;

    // events
    event RaffleEnter(address indexed player); //name of event shud be reverse of fn in which its is used
    event RequestedRaffleWinner(uint256 requestId);
    event WinnerPicked(address indexed player);

    // state of contract
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    constructor(
        address vrfCoordinatorAddress,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 timeInterval,
        uint256 prevTimeStamp
    ) VRFConsumerBaseV2(vrfCoordinatorAddress) {
        //vrfCoordinatorAddress is the addr of contract that verifies the random no
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorAddress);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        i_timeInterval = timeInterval;
        s_prevTimeStamp = prevTimeStamp;
        s_raffleState = RaffleState.OPEN; // specifying raffle state is open
    }

    function enterRaffle() public payable {
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpened();
        }
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEntranceFee();
        }

        s_players.push(payable(msg.sender));

        emit RaffleEnter(msg.sender);
    }

    function requestRandomWinner() external {
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords( //reqRandomnwords is fn of i_vrfcoordinator contract and it returns a id that
            // tells who made the request and other information
            i_gasLane, // or gasLane- the max amt willing to pay(in wei) for gas
            i_subscriptionId,
            REQUEST_CONFIRMATIONS, // no of confirmations after nodes respond
            i_callbackGasLimit,
            NUM_WORDS // no of random values we want
        );

        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory randomWords // its arr of random we requested and we requested 1 random value
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length; // randomWords[0] may be 250000545454554955584652651544544 smtg like this long
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        // sending contract balance to winner
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }

        // keep track of all winners
        emit WinnerPicked(recentWinner);
    }

    // view / pure functions
    function viewEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    // function checkUpkeep(
    //     bytes memory /*checkData*/
    // )
    //     external
    //     override
    //     returns (bool upkeepNeeded, bytes memory /*performData*/)
    // {
    //     // if 4 conditions satisfied retyurn false
    //     // 1. check if raffle is open and time interval is passed
    //     // 2. check atleast 1 players is present and has some eth
    //     // 3. check if subscription has some link
    //     // 4. lottery in open state
    //     bool isOpen = (RaffleState.OPEN == s_raffleState);
    //     bool hasPassed = ((block.timestamp - s_prevTimeStamp) > i_timeInterval);
    //     bool hasPlayers = (s_players.length > 0);
    //     bool hasBalance = (address(this).balance > 0);
    //     upkeepNeeded = (isOpen && hasPlayers && hasBalance && hasPassed);
    //     return (upkeepNeeded, "0x0");
    // }

    // function performUpkeep(bytes calldata performData) external override {
    //     // (bool upkeepNeeded, ) = checkUpkeep("");0
    //     (bool upkeepNeeded, ) = checkUpkeep("");
    //     if (!upkeepNeeded) {
    //         revert Raffle__UpKeepNotNeeded(
    //             address(this.balance),
    //             s_players.length,
    //             s_raffleState
    //         );
    //     }

    //     s_raffleState = RaffleState.CALCULATING;
    //     uint256 requestId = i_vrfCoordinator.requestRandomWords( //reqRandomnwords is fn of i_vrfcoordinator contract and it returns a id that
    //         // tells who made the request and other information
    //         i_gasLane, // or gasLane- the max amt willing to pay(in wei) for gas
    //         i_subscriptionId,
    //         REQUEST_CONFIRMATIONS, // no of confirmations after nodes respond
    //         i_callbackGasLimit,
    //         NUM_WORDS // no of random values we want
    //     );

    //     emit RequestedRaffleWinner(requestId);
    // }

    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = RaffleState.OPEN == s_raffleState;
        bool timePassed = ((block.timestamp - s_prevTimeStamp) >
            i_timeInterval);
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers);
        return (upkeepNeeded, "0x0"); // can we comment this out?
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        // require(upkeepNeeded, "Upkeep not needed");
        if (!upkeepNeeded) {
            revert Raffle__UpKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        // Quiz... is this redundant?
        emit RequestedRaffleWinner(requestId);
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNoPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getTimeStamp() public view returns (uint256) {
        return s_prevTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }
}
