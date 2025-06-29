// src/components/LoginModal.tsx
import React, { useState } from 'react';
import { TextField, Button } from '@mui/material';
import { BaseModal } from './common/BaseModal';
import { useAuth, EmailSignInCredentials } from '../context/AuthContext';
import CaptchaWidget from './CaptchaWidget';

interface LoginModalProps {
	open: boolean;
	onClose: () => void;
	onOpenSignup: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ open, onClose, onOpenSignup }) => {
	const [formData, setFormData] = useState({ email: '', password: '' });
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);
	const { signInWithEmail } = useAuth();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		if (!captchaToken) {
			setError("Please complete the CAPTCHA challenge.");
			setLoading(false);
			return;
		}

		const credentials: EmailSignInCredentials = {
			email: formData.email,
			password: formData.password,
			options: { captchaToken }
		};

		const { error: signInError } = await signInWithEmail(credentials);
		setLoading(false);

		if (signInError) {
			setError(signInError.message);
		} else {
			onClose(); // Close modal on successful login
		}
	};

	return (
		<BaseModal
			open={open}
			onClose={onClose}
			title="Login"
			subtitle="Welcome back! Please login to your account."
			loading={loading}
			error={error}
			maxWidth="xs"
			actions={
				<>
					<Button onClick={onOpenSignup} color="inherit">
						Create Account
					</Button>
					<Button
						variant="contained"
						onClick={handleSubmit}
						disabled={loading || !captchaToken}
					>
						Login
					</Button>
				</>
			}
		>
			<form onSubmit={handleSubmit}>
				<TextField
					label="Email"
					fullWidth
					margin="normal"
					value={formData.email}
					onChange={(e) => setFormData({ ...formData, email: e.target.value })}
					autoComplete="email"
				/>
				<TextField
					label="Password"
					type="password"
					fullWidth
					margin="normal"
					value={formData.password}
					onChange={(e) => setFormData({ ...formData, password: e.target.value })}
					autoComplete="current-password"
				/>
				<CaptchaWidget onVerify={setCaptchaToken} />
			</form>
		</BaseModal>
	);
};

export default LoginModal;