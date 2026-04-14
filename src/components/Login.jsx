import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        const success = await login(username, password);
        if (!success) {
            setError('Invalid credentials or unauthorized access.');
        }
    };

    return (
        <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="#060e1a">
            <Paper elevation={0} sx={{ p: 5, width: 400, borderRadius: 2, border: '1px solid', borderColor: 'primary.main', bgcolor: '#0d1f3c' }}>
                <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
                    <LockOutlinedIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'primary.main', letterSpacing: '2px' }}>
                        {'// '}OPENPRIX
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        SECURE SYSTEM ACCESS
                    </Typography>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{error}</Alert>}

                <form onSubmit={handleLogin}>
                    <Box display="flex" flexDirection="column" gap={3}>
                        <TextField
                            label="EMPLOYEE ID / USERNAME"
                            variant="outlined"
                            fullWidth
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                        />
                        <TextField
                            label="SYSTEM PIN / PASSWORD"
                            type="password"
                            variant="outlined"
                            fullWidth
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            fullWidth
                            disableElevation
                            sx={{ mt: 2, py: 1.5, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}
                        >
                            AUTHENTICATE
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}