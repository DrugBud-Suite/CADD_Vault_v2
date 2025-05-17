import React, { useState, useEffect } from 'react';
import { Modal, Box, Typography, TextField, Button, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import CaptchaWidget from './CaptchaWidget'; // Import the new component

interface SignupModalProps {
	open: boolean;
	onClose: () => void;
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

const SignupModal: React.FC<SignupModalProps> = ({ open, onClose }) => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [passwordValidations, setPasswordValidations] = useState({
		minLength: false,
		hasLowercase: false,
		hasUppercase: false,
		hasDigit: false,
		hasSymbol: false,
	});
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [captchaToken, setCaptchaToken] = useState<string | null>(null); // State for captcha token
	const { signUpWithEmail } = useAuth();

	const validatePassword = (pwd: string) => {
		setPasswordValidations({
			minLength: pwd.length >= 8,
			hasLowercase: /[a-z]/.test(pwd),
			hasUppercase: /[A-Z]/.test(pwd),
			hasDigit: /[0-9]/.test(pwd),
			hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(pwd),
		});
	};

	// No need for useEffect to handle Turnstile lifecycle here,
	// as it's managed by the CaptchaWidget component.

	const handleSignup = async () => {
		setError(null);
		setLoading(true);

		if (!captchaToken) {
			setError("Please complete the CAPTCHA challenge.");
			setLoading(false);
			return;
		}

		const credentials: SignUpWithPasswordCredentials = {
			email,
			password,
			options: { captchaToken } // Always include captchaToken
		};

		const { error } = await signUpWithEmail(credentials);
		setLoading(false);

		if (error) {
			setError(error.message);
		} else {
			// Handle successful signup, e.g., show a success message or close modal
			onClose();
		}
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			aria-labelledby="signup-modal-title"
			aria-describedby="signup-modal-description"
		>
			<Box sx={style}>
				<Typography id="signup-modal-title" variant="h6" component="h2">
					Sign Up
				</Typography>
				{error && <Alert severity="error">{error}</Alert>}
				<form onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
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
						onChange={(e) => {
							setPassword(e.target.value);
							validatePassword(e.target.value);
						}}
						error={Object.values(passwordValidations).some(isValid => !isValid) && password !== ''}
						helperText={
							password !== '' && (
								<>
									{!passwordValidations.minLength && 'Minimum 8 characters\n'}
									{!passwordValidations.hasLowercase && 'At least one lowercase letter\n'}
									{!passwordValidations.hasUppercase && 'At least one uppercase letter\n'}
									{!passwordValidations.hasDigit && 'At least one digit\n'}
									{!passwordValidations.hasSymbol && 'At least one symbol\n'}
								</>
							)
						}
						autoComplete="new-password"
					/>
					<CaptchaWidget onVerify={setCaptchaToken} /> {/* Use the new CaptchaWidget */}
					<Button
						variant="contained"
						type="submit" // Set type to submit
						disabled={loading || Object.values(passwordValidations).some(isValid => !isValid) || password === '' || !captchaToken} // Disable if loading, password invalid, or no captcha token
					>
						{loading ? 'Signing Up...' : 'Sign Up'}
					</Button>
				</form>
			</Box>
		</Modal>
	);
};

export default SignupModal;