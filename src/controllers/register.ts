import { Pool } from 'pg';
import { server } from '@passwordless-id/webauthn';
import { generateWalletAddress } from '../server.js';

export async function registerController(req : any, res : any, pool: Pool) {
    try {
        const registration = req.body;
        console.log("Registration:",registration)
        const challengeResult = await pool.query('SELECT challenge FROM challenges WHERE username = $1', [registration.username]);
        if (!challengeResult.rows.length) {
            throw new Error('Invalid challenge');
        }


        const expected = {
            challenge: String(challengeResult.rows[0].challenge), 
            origin: "https://bitpack-webauthn-client.vercel.app"
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
}
