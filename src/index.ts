import express, { Request, Response } from "express";
//Use BitGo
import { BitGo } from "bitgo";
//Import SupaBase
import { createClient } from "@supabase/supabase-js";

import mempoolJS from "@mempool/mempool.js";

//Create BitGo Instance
const bitgo = new BitGo({
  accessToken:
    "v2xec16953cfd8407ab378a1ea7f1e1e25eb2a2bf399f3c4f0041ea3ae78e49d2c4",
  env: "test",
}); // defaults to testnet.

//Create SupaBase instance
const supabaseUrl = "https://vybntsrjighzpbvzmhml.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Ym50c3JqaWdoenBidnptaG1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5NDI1MTQ0MCwiZXhwIjoyMDA5ODI3NDQwfQ.kInoltpekaYZ-mM9xuuJuOW0s-nAUEk18Fa07WO9_o4";
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const port = process.env.PORT || 8080;
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  return res.send("Express Typescript on Vercel");
});

app.get("/getBtcAddress", async (_req: Request, res: Response) => {
  let walletId = "64fc420ba45af400074c881e694da227";
  bitgo
    .coin("tbtc")
    .wallets()
    .get({
      id: walletId,
    })
    .then(function (wallet: any) {
      // print the wallet
      wallet.createAddress().then(async function (address: any) {
        await supabase
          .from("Addresses")
          .insert([
            {
              address: address.address,
              Coin_Type: "tBTC",
            },
          ])
          .select();
        return res.send({
          status: 200,
          message: "account created",
          data: address.address,
        });
      });
    })
    .catch(function (error: any) {
      res.send({
        stats: 503,
        message: error,
      });
    });
});

app.post("/getDeposits", async (_req: Request, res: Response) => {
  await supabase
    .from("Deposits")
    .select("*")

    // Filters
    .eq("address", _req.body.address)
    .then((result) => {
      res.send({
        data: result,
      });
    });
});

app.post("/getBalance", async (_req: Request, res: Response) => {
  await supabase
    .from("Addresses")
    .select("*")

    // Filters
    .eq("address", _req.body.address)
    .then((result) => {
      return res.send({
        data: {
          address: result.data[0] ? result.data[0].address : "Not Found",
          balance: result.data[0] ? result.data[0].balance : "Not Found",
        },
      });
    });
});

app.post("/bitgoWebhook", async (_req: Request, res: Response) => {
  const {
    bitcoin: { transactions },
  } = mempoolJS({
    hostname: "mempool.space",
    network: "testnet",
  });

  const txid = _req.body.hash;
  const tx = await transactions.getTx({
    txid,
  });
  console.log(tx);

  await supabase
    .from("Deposits")
    .insert([
      {
        txid: "https://mempool.space/testnet/tx/" + txid,
        amount: tx.vout[0].value,
        address: tx.vout[0].scriptpubkey_address,
      },
    ])
    .select();

  await supabase
    .from("Addresses")
    .select()
    .eq("address", tx.vout[0].scriptpubkey_address)
    .then(async (result) => {
      if (result.data.length === 1) {
        await supabase
          .from("Addresses")
          .update({ balance: +result.data[0].balance + +tx.vout[0].value })
          .eq("address", tx.vout[0].scriptpubkey_address)
          .select()
          .then(() => {
            return res.status(200).send({
              data: result,
            });
          });
      }
    });
});

app.post("/btcWithdrawal", (_req: Request, res: Response) => {
  let walletId = "64fc420ba45af400074c881e694da227";
  bitgo
    .coin("tbtc")
    .wallets()
    .get({
      id: walletId,
    })
    .then(async function (wallet: any) {
      await wallet
        .sendMany({
          recipients: [
            {
              amount: _req.body.amount,
              address: _req.body.address,
            },
          ],
          walletPassphrase: "cqtnHQN5nFMYSLw",
        })
        .then((result: any) => {
          console.dir(result);
          return res.status(200).send({
            data: {
              receiver: _req.body.address,
              amount: _req.body.amount,
              txHash:
                "https://mempool.space/testnet/tx/" + result.transfer.txid,
            },
          });
        });
    })
    .catch(() => {
      return res.status(503).send({
        data: {
          message: "Error withdrawing funds",
        },
      });
    });
});
app.get("/ping", (_req: Request, res: Response) => {
  return res.send("pong 🏓");
});

app.listen(port, () => {
  return console.log(`Server is listening on ${port}`);
});
