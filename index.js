const express = require("express");
const Moralis = require("moralis").default;
const app = express();
const cors = require("cors");
const bodyParser = require('body-parser');
const fs = require('fs');
require("dotenv").config();
const port = 3001;
const { Web3 } = require('web3');
const fetch = require("node-fetch");
const yesno = require("yesno");

const chainId = 56; // Chain ID for Binance Smart Chain (BSC)
const web3RpcUrl = "https://bsc-dataseed.binance.org"; // URL for BSC node
const web3 = new Web3(web3RpcUrl);
const walletAddress = process.env.WALLET_ADDRESS; // Your wallet addressE!
const apiBaseUrl = "https://api.1inch.dev/swap/v5.2/" + chainId;

const headers = { headers: { Authorization: `Bearer ${process.env.INCHAPI_KEY}`, accept: "application/json" } };

// Construct full API request URL
function apiRequestUrl(methodName, queryParams) {
  return apiBaseUrl + methodName + "?" + new URLSearchParams(queryParams).toString();
}

// Post raw transaction to the API and return transaction hash
async function broadCastRawTransaction(rawTransaction) {
  return fetch(broadcastApiUrl, {
    method: "post",
    body: JSON.stringify({ rawTransaction }),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INCHAPI_KEY}` },
  })
    .then((res) => res.json())
    .then((res) => {
      return res.transactionHash;
    });
}

async function buildTxForApproveTradeWithRouter(tokenAddress, amount) {
  const url = apiRequestUrl("/approve/transaction", amount ? { tokenAddress, amount } : { tokenAddress });

  const transaction = await fetch(url, headers).then((res) => res.json());

  const gasLimit = await web3.eth.estimateGas({
    ...transaction,
    from: walletAddress,
  });

  return {
    ...transaction,
    gas: gasLimit,
  };
}

async function tokenSwap(tokenAddressOne, tokenAddressTwo, amount, walletAddress, slippage) {
  const url = `https://api.1inch.dev/swap/v5.2/56/swap?src=${tokenAddressOne}&dst=${tokenAddressTwo}&amount=${amount}&from=${walletAddress}&slippage=${slippage}`;

  const transaction = await fetch(url, headers).then((res) => res.json());

  const gasLimit = await web3.eth.estimateGas({
    ...transaction,
    from: walletAddress,
  });

  return {
    ...transaction,
    gas: gasLimit,
  };
}


// Sign and post a transaction, return its hash
// async function signAndSendTransaction(transaction) {
//   const { rawTransaction } = await web3.eth.accounts.signTransaction(transaction, privateKey);

//   return await broadCastRawTransaction(rawTransaction);
// }

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/approve', async (req, res) => {
  const transactionForSign = await buildTxForApproveTradeWithRouter(req.body.tokenAddress);
  console.log("Transaction for approve: ", transactionForSign);
  const gasAsString = transactionForSign.gas.toString();

  res.send({ result: { ...transactionForSign, gas: gasAsString } });
})

app.post('/swap', async (req, res) => {
  const { tokenAddressOne, tokenAddressTwo, amount, walletAddr, slippage } = req.body;
  const transactionForSign = await tokenSwap(tokenAddressOne, tokenAddressTwo, amount, walletAddr, slippage);

  console.log("Transaction for approve: ", transactionForSign);
  const gasAsString = transactionForSign.gas.toString();

  res.send({ result: { ...transactionForSign, gas: gasAsString } });
})

app.get('/test', async (req, res) => {
  fetch('https://api.1inch.dev/swap/v5.2/56/tokens', {
    method: "get",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INCHAPI_KEY}` },
  })
    .then((result) => result.json())
    .then((data) => {
      console.log("data: " + data);
      // fs.writeFile("tokens.json", JSON.stringify(data, null, 2), (err) => {
      //   if (err) {
      //     console.error(err);
      //     return;
      //   }
      //   console.log("Successfully written data to file");
      // });
      res.send(data);
    })
})
app.get("/tokenPrice", async (req, res) => {

  console.log("here");

  const { query } = req;

  // Make the GET reques

  const responseOne = await Moralis.EvmApi.token.getTokenPrice({
    address: query.addressOne
  })

  const responseTwo = await Moralis.EvmApi.token.getTokenPrice({
    address: query.addressTwo
  })

  const total = await Moralis.EvmApi.balance.getNativeBalance({
    address: "0x4d7fcEB021ae8b2B98762a1eDbb88629D4f04F19",
    chain: 0x38
  })

  const usdPrices = {
    tokenOne: responseOne.raw.usdPrice,
    tokenTwo: responseTwo.raw.usdPrice,
    ratio: responseOne.raw.usdPrice / responseTwo.raw.usdPrice,
    total
  }


  return res.status(200).json(usdPrices);
});

Moralis.start({
  apiKey: process.env.MORALIS_KEY,
}).then(() => {
  app.listen(port, () => {
    console.log(`Listening for API Calls`);
  });
});
