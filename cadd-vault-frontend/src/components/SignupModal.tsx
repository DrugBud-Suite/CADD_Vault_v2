import React, { useState } from 'react';
import { TextField, Button } from '@mui/material';
import { BaseModal } from './common/BaseModal';
import { useAuth } from '../context/AuthContext';
import { SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import { useValidation, passwordValidators, emailValidators } from '../utils/validation';
import CaptchaWidget from './CaptchaWidget';

interface SignupModalProps {
	open: boolean;
	onClose: () => void;
}

const SignupModal: React.FC<SignupModalProps> = ({ open, onClose }) => {
	const [formData, setFormData] = useState({ email: '', password: '' });
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);
	const { signUpWithEmail } = useAuth();

	// Validation schema using new validation utilities
	const validationSchema = {
		email: {
			required: true,
			rules: [emailValidators.isValidEmail()]
		},
		password: {
			required: true,
			rules: [
				passwordValidators.minLength(8),
				passwordValidators.hasLowercase(),
				passwordValidators.hasUppercase(),
				passwordValidators.hasDigit(),
				passwordValidators.hasSpecialChar()
			]
		}
	};

	const { errors, validate, validateField } = useValidation(validationSchema);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		// Validate form using new validation utilities
		if (!validate(formData)) {
			setLoading(false);
			return;
		}

		if (!captchaToken) {
			setError("Please complete the CAPTCHA challenge.");
			setLoading(false);
			return;
		}

		const credentials: SignUpWithPasswordCredentials = {
			email: formData.email,
			password: formData.password,
			options: { captchaToken }
		};

		const { error: signUpError } = await signUpWithEmail(credentials);
		setLoading(false);

		if (signUpError) {
			setError(signUpError.message);
		} else {
			onClose();
		}
	};

	return (
		<BaseModal
			open={open}
			onClose={onClose}
			title="Sign Up"
			subtitle="Create your account to start rating and suggesting packages."
			loading={loading}
			error={error}
			maxWidth="xs"
			actions={
				<Button
					variant="contained"
					onClick={handleSubmit}
					disabled={loading || !captchaToken || Object.keys(errors).length > 0}
				>
					Sign Up
				</Button>
			}
		>
			<form onSubmit={handleSubmit}>
				<TextField
					label="Email"
					fullWidth
					margin="normal"
					value={formData.email}
					onChange={(e) => {
						setFormData({ ...formData, email: e.target.value });
						validateField('email', e.target.value);
					}}
					error={!!errors.email}
					helperText={errors.email}
					autoComplete="email"
				/>
				<TextField
					label="Password"
					type="password"
					fullWidth
					margin="normal"
					value={formData.password}
					onChange={(e) => {
						setFormData({ ...formData, password: e.target.value });
						validateField('password', e.target.value);
					}}
					error={!!errors.password}
					helperText={errors.password || 'Password must contain: 8+ characters, uppercase, lowercase, digit, and special character'}
					autoComplete="new-password"
				/>
				<CaptchaWidget onVerify={setCaptchaToken} />
			</form>
		</BaseModal>
	);
};

export default SignupModal;