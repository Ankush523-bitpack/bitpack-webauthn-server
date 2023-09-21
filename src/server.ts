import express from 'express';
import pkg from 'pg';
import { server } from '@passwordless-id/webauthn';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { Wallet } from 'ethers';

const app = express();
app.use(cors());

function generateWalletAddress(): { address: string, privateKey: string } {
    const wallet = Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey
    };
}


const port = 3000;

const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'webauthn',
    password: 'postgres',
    port: 5432,
});

app.use(express.json());

app.post('/request-challenge', async (req, res) => {
    try {
        const username = req.body.username;
        const challenge = uuidv4(); // Using uuid as a challenge
        console.log(`Challenge generated for ${username}: ${challenge}`);
        await pool.query('INSERT INTO challenges (challenge, username) VALUES ($1, $2)', [challenge, username]);
        console.log(`Challenge stored for ${username}: ${challenge}`);
        res.json({ challenge });
    } catch (error) {
        res.status(500).json({ error: 'Failed to request challenge.' });
    }
});

app.post('/register', async (req, res) => {
    console.log("Registering")
    try {
        const registration = req.body;
        console.log("Registration:",registration)
        const challengeResult = await pool.query('SELECT challenge FROM challenges WHERE username = $1', [registration.username]);
        if (!challengeResult.rows.length) {
            throw new Error('Invalid challenge');
        }


        const expected = {
            challenge: String(challengeResult.rows[0].challenge), 
            origin: "https://bitpack-webauthn-client.vercel.app/"
        };

        console.log("Expected:",expected)

        console.log(registration)
        
        const registrationParsed = await server.verifyRegistration(registration, expected)
        console.log("Registration parsed:",registrationParsed)

        const walletAddr = generateWalletAddress();
        console.log("Wallet address:",walletAddr.address)

        // const registrationParsed = await server.verifyRegistration(registration, expected);
        // console.log(`Registration verified for ${registration.username}: ${registrationParsed.credential.id}`);

        // Store registration details in the database
        await pool.query('INSERT INTO users (username, credential_id, public_key, algorithm, wallet_address) VALUES ($1, $2, $3, $4, $5)', [registration.username, registrationParsed.credential.id, registrationParsed.credential.publicKey, registrationParsed.credential.algorithm, walletAddr.address]);

        console.log(`Registration and wallet address stored for ${registration.username}: ${registrationParsed.credential.id}`);

        res.json({ success: true });
    } catch (error:any) {
        res.status(500).json({ error: 'Failed to register. ' + error.message });
    }
});

app.get('/credentials/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await pool.query('SELECT credential_id, wallet_address FROM users WHERE username = $1', [username]);
        if (!result.rows.length) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        
        const credentialIds = result.rows.map(row => row.credential_id);
        const walletAddress = result.rows[0].wallet_address; // Assuming one row per user
        res.json({ credentialIds, walletAddress });
    } catch (error:any) {
        res.status(500).json({ error: 'Failed to fetch credentials. ' + error.message });
    }
});


app.post('/authenticate', async (req, res) => {
    try {
        const { challenge, authentication } = req.body;
        console.log("Authentication:",authentication)
        console.log("Challenge:",challenge)
        const userRecord = await pool.query('SELECT * FROM users WHERE credential_id = $1', [authentication.credentialId]);
        if (!userRecord.rows.length) {
            throw new Error('Invalid credential ID');
        }

        const expected = {
            challenge: challenge, 
            origin: "https://bitpack-webauthn-client.vercel.app/",
            userVerified: true,
            counter: -1 // Retrieve stored counter for the user
        };

        console.log("Expected:",expected)

        console.log("User record:",userRecord.rows[0])

        const credentialKey  = {
            id: userRecord.rows[0].credential_id,
            publicKey: userRecord.rows[0].public_key,
            algorithm: userRecord.rows[0].algorithm
        } as const

        console.log("Credential key:",credentialKey)

        const authenticationParsed = await server.verifyAuthentication(authentication, credentialKey, expected)
        console.log("Authentication parsed:",authenticationParsed)
        console.log(`Authentication verified for ${userRecord.rows[0].username}: ${authentication.credentialId}`);

        res.json({ success: true });
    } catch (error:any) {
        res.status(500).json({ error: 'Failed to authenticate. ' + error.message });
    }
});

app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
