"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
//Use BitGo
const bitgo_1 = require("bitgo");
//Import SupaBase
const supabase_js_1 = require("@supabase/supabase-js");
const mempool_js_1 = __importDefault(require("@mempool/mempool.js"));
//Create BitGo Instance
const bitgo = new bitgo_1.BitGo({
    accessToken: "v2xec16953cfd8407ab378a1ea7f1e1e25eb2a2bf399f3c4f0041ea3ae78e49d2c4",
    env: "test",
}); // defaults to testnet.
//Create SupaBase instance
const supabaseUrl = "https://vybntsrjighzpbvzmhml.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Ym50c3JqaWdoenBidnptaG1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5NDI1MTQ0MCwiZXhwIjoyMDA5ODI3NDQwfQ.kInoltpekaYZ-mM9xuuJuOW0s-nAUEk18Fa07WO9_o4";
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    return res.send("Express Typescript on Vercel");
});
app.get("/getBtcAddress", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let walletId = "64fc420ba45af400074c881e694da227";
    bitgo
        .coin("tbtc")
        .wallets()
        .get({
        id: walletId,
    })
        .then(function (wallet) {
        // print the wallet
        wallet.createAddress().then(function (address) {
            return __awaiter(this, void 0, void 0, function* () {
                yield supabase
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
        });
    })
        .catch(function (error) {
        res.send({
            stats: 503,
            message: error,
        });
    });
}));
app.post("/getDeposits", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield supabase
        .from("Deposits")
        .select("*")
        // Filters
        .eq("address", _req.body.address)
        .then((result) => {
        res.send({
            data: result,
        });
    });
}));
app.post("/getBalance", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield supabase
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
}));
app.post("/bitgoWebhook", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { bitcoin: { transactions }, } = (0, mempool_js_1.default)({
        hostname: "mempool.space",
        network: "testnet",
    });
    const txid = _req.body.hash;
    const tx = yield transactions.getTx({
        txid,
    });
    console.log(tx);
    yield supabase
        .from("Deposits")
        .insert([
        {
            txid: "https://mempool.space/testnet/tx/" + txid,
            amount: tx.vout[0].value,
            address: tx.vout[0].scriptpubkey_address,
        },
    ])
        .select();
    yield supabase
        .from("Addresses")
        .select()
        .eq("address", tx.vout[0].scriptpubkey_address)
        .then((result) => __awaiter(void 0, void 0, void 0, function* () {
        if (result.data.length === 1) {
            yield supabase
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
    }));
}));
app.post("/btcWithdrawal", (_req, res) => {
    let walletId = "64fc420ba45af400074c881e694da227";
    bitgo
        .coin("tbtc")
        .wallets()
        .get({
        id: walletId,
    })
        .then(function (wallet) {
        return __awaiter(this, void 0, void 0, function* () {
            yield wallet
                .sendMany({
                recipients: [
                    {
                        amount: _req.body.amount,
                        address: _req.body.address,
                    },
                ],
                walletPassphrase: "cqtnHQN5nFMYSLw",
            })
                .then((result) => {
                console.dir(result);
                return res.status(200).send({
                    data: {
                        receiver: _req.body.address,
                        amount: _req.body.amount,
                        txHash: "https://mempool.space/testnet/tx/" + result.transfer.txid,
                    },
                });
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
app.get("/ping", (_req, res) => {
    return res.send("pong 🏓");
});
app.listen(port, () => {
    return console.log(`Server is listening on ${port}`);
});
//# sourceMappingURL=index.js.map