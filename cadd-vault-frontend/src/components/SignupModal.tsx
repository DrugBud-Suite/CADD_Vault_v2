import React, { useState } from 'react';
import { Modal, Typography, TextField, Button, Alert, Paper } from '@mui/material'; // Removed Box, kept Paper
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
	bgcolor: 'background.paper', // Use theme background
	// border: '2px solid #000', // Removed border
	borderRadius: '12px', // Added border radius
	boxShadow: 24,
	p: 4, // Keep padding
	display: 'flex',
	flexDirection: 'column',
	gap: 3, // Increased gap for better spacing
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
			<Paper sx={style}>
				<Typography id="signup-modal-title" variant="h5" component="h2" sx={{ textAlign: 'center', fontWeight: 'bold', mb: 1 }}> {/* Centered and styled title */}
					Sign Up
				</Typography>
				{error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>} {/* Ensure alert takes full width */}
				<form onSubmit={(e) => { e.preventDefault(); handleSignup(); }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}> {/* Added gap to form elements */}
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
									{!passwordValidations.minLength && <Typography variant="caption" display="block" color="error">Minimum 8 characters</Typography>}
									{!passwordValidations.hasLowercase && <Typography variant="caption" display="block" color="error">At least one lowercase letter</Typography>}
									{!passwordValidations.hasUppercase && <Typography variant="caption" display="block" color="error">At least one uppercase letter</Typography>}
									{!passwordValidations.hasDigit && <Typography variant="caption" display="block" color="error">At least one digit</Typography>}
									{!passwordValidations.hasSymbol && <Typography variant="caption" display="block" color="error">At least one symbol</Typography>}
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
						sx={{ py: 1.5, fontWeight: 'bold' }} // Made button taller and text bold
					>
						{loading ? 'Signing Up...' : 'Sign Up'}
					</Button>
				</form>
			</Paper>
		</Modal>
	);
};

export default SignupModal;