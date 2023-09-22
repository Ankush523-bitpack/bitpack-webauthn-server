import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export async function requestChallengeController(req : any, res : any, pool: Pool) {
    try {
        const username = req.body.username;
        const challenge = uuidv4();
        console.log(`Challenge generated for ${username}: ${challenge}`);
        await pool.query('INSERT INTO challenges (challenge, username) VALUES ($1, $2)', [challenge, username]);
        console.log(`Challenge stored for ${username}: ${challenge}`);
        res.json({ challenge });
    } catch (error) {
        res.status(500).json({ error: 'Failed to request challenge.' });
    }
}
