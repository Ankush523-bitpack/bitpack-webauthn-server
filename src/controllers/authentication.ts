import { Pool } from 'pg';
import { server } from '@passwordless-id/webauthn';

export async function authenticationController(req : any, res : any, pool: Pool) {
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
            origin: "https://bitpack-webauthn-client.vercel.app",
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
}
