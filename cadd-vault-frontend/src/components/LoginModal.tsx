import React, { useState } from 'react';
import { Modal, Box, Typography, TextField, Button, Alert } from '@mui/material';
import { useAuth, EmailSignInCredentials } from '../context/AuthContext';
import CaptchaWidget from './CaptchaWidget'; // Import the new component

interface LoginModalProps {
	open: boolean;
	onClose: () => void;
	onOpenSignup: () => void;
}

const style = {
	position: 'absolute' as 'absolute',
	top: '50%',
	left: '50%',
	transform: 'translate(-50%, -50%)',
	width: 400,
	bgcolor: 'background.paper',
	border: '2px solid #000',
	boxShadow: 24,
	p: 4,
	display: 'flex',
	flexDirection: 'column',
	gap: 2,
};

const LoginModal: React.FC<LoginModalProps> = ({ open, onClose, onOpenSignup }) => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [captchaToken, setCaptchaToken] = useState<string | null>(null); // State for captcha token
	const { signInWithEmail } = useAuth();

	const handleLogin = async () => {
		setError(null);
		setLoading(true);

		if (!captchaToken) {
			setError("Please complete the CAPTCHA challenge.");
			setLoading(false);
			return;
		}

		const credentials: EmailSignInCredentials = {
			email,
			password,
			options: { captchaToken } // Always include captchaToken
		};

		const { error } = await signInWithEmail(credentials);
		setLoading(false);

		if (error) {
			setError(error.message);
		} else {
			onClose(); // Close modal on successful login
		}
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			aria-labelledby="login-modal-title"
			aria-describedby="login-modal-description"
		>
			<Box sx={style}>
				<Typography id="login-modal-title" variant="h6" component="h2">
					Login
				</Typography>
				{error && <Alert severity="error">{error}</Alert>}
				<form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
					<TextField
						label="Email"
						variant="outlined"
						fullWidth
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
					/>
					<TextField
						label="Password"
						variant="outlined"
						type="password"
						fullWidth
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
					/>
					<CaptchaWidget onVerify={setCaptchaToken} /> {/* Use the new CaptchaWidget */}
					<Button
						variant="contained"
						type="submit" // Set type to submit
						disabled={loading || !captchaToken} // Disable if loading or no captcha token
					>
						{loading ? 'Logging In...' : 'Login'}
					</Button>
				</form>
				<Button
					variant="text"
					onClick={onOpenSignup}
					color="primary"
					size="small"
					sx={{ mt: 1 }}
				>
					Don't have an account? Sign Up
				</Button>
			</Box>
		</Modal>
	);
};

export default LoginModal;