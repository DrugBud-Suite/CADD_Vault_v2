import React from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

interface CaptchaWidgetProps {
	onVerify: (token: string | null) => void;
}

const CaptchaWidget: React.FC<CaptchaWidgetProps> = ({ onVerify }) => {
	const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY_PROD;

	// Ensure siteKey is a string, otherwise provide a default or handle error
	const turnstileSiteKey = typeof siteKey === 'string' ? siteKey : '';

	if (!turnstileSiteKey) {
		console.error('Turnstile site key is not defined. Please check your environment variables (VITE_TURNSTILE_SITE_KEY_PROD).');
		// Optionally, render a message to the user or return null
		return <div>Error: CAPTCHA site key not configured.</div>;
	}

	return (
		<Turnstile
			siteKey={turnstileSiteKey}
			onSuccess={(token) => {
				onVerify(token);
			}}
			onError={() => {
				onVerify(null);
			}}
			onExpire={() => {
				onVerify(null);
				// Optionally, you might want to add logic to reset the widget if the library supports it directly
				// or inform the user they need to re-verify.
			}}
		/>
	);
};

export default CaptchaWidget;