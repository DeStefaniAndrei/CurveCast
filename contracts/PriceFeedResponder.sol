// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@polytope-labs/ismp-solidity/interfaces/IIsmpModule.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { IncomingPostRequest, IncomingPostResponse, IncomingGetResponse } from "@polytope-labs/ismp-solidity/interfaces/IIsmpModule.sol";
import { PostRequest, PostResponse, GetRequest } from "@polytope-labs/ismp-solidity/interfaces/Message.sol";

contract PriceFeedResponder is IIsmpModule {
    AggregatorV3Interface public priceFeed;

    event PriceRequested(bytes request, int256 price);

    constructor(address _feed) {
        priceFeed = AggregatorV3Interface(_feed);
    }

    // Handle cross-chain request from Hyperbridge
    function onAccept(IncomingPostRequest memory incoming) external override {
        (, int256 price,,,) = priceFeed.latestRoundData();
        emit PriceRequested(incoming.request.body, price);
        // Encode and send as response (actual response mechanism may depend on Hyperbridge relayer/config)
        // For most setups, the relayer will pick up the event and relay the response
        // If explicit response call is needed, add it here per Hyperbridge docs
    }
    function onPostResponse(IncomingPostResponse memory) external override {}
    function onGetResponse(IncomingGetResponse memory) external override {}
    function onGetTimeout(GetRequest memory) external override {}
    function onPostRequestTimeout(PostRequest memory) external override {}
    function onPostResponseTimeout(PostResponse memory) external override {}
} 