import React, { useState } from 'react';
import { Modal, Typography, TextField, Button, Alert, Paper } from '@mui/material'; // Removed Box, kept Paper
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
	bgcolor: 'background.paper', // Use theme background
	// border: '2px solid #000', // Removed border
	borderRadius: '12px', // Added border radius
	boxShadow: 24,
	p: 4, // Keep padding
	display: 'flex',
	flexDirection: 'column',
	gap: 3, // Increased gap for better spacing
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
			<Paper sx={style}>
				<Typography id="login-modal-title" variant="h5" component="h2" sx={{ textAlign: 'center', fontWeight: 'bold', mb: 1 }}> {/* Centered and styled title */}
					Login
				</Typography>
				{error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>} {/* Ensure alert takes full width */}
				<form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}> {/* Added gap to form elements */}
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
						sx={{ py: 1.5, fontWeight: 'bold' }} // Made button taller and text bold
					>
						{loading ? 'Logging In...' : 'Login'}
					</Button>
				</form>
				<Button
					variant="text"
					onClick={onOpenSignup}
					color="primary"
					size="small"
					sx={{ mt: 1, alignSelf: 'center' }} // Centered the signup button
				>
					Don't have an account? Sign Up
				</Button>
			</Paper>
		</Modal>
	);
};

export default LoginModal;