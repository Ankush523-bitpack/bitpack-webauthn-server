import { Pool } from 'pg';

export async function credentialUsernameController(req:any, res:any, pool: Pool) {
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
}
