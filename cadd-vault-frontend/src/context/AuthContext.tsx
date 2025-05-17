// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabase'; // Import Supabase client
import { Session, User, AuthError, SignInWithPasswordCredentials, SignUpWithPasswordCredentials } from '@supabase/supabase-js'; // Import Supabase types

interface EmailSignUpCredentials {
	email: string;
	password: string;
	options?: {
		data?: object;
		captchaToken?: string;
		channel?: "sms" | "whatsapp";
	};
}

export interface EmailSignInCredentials {
	email: string;
	password: string;
	options?: {
		captchaToken?: string;
	};
}

interface AuthContextType {
	currentUser: User | null;
	session: Session | null; // Expose session for potential use
	loading: boolean;
	signUpWithEmail: (credentials: EmailSignUpCredentials) => Promise<{ data?: { user: User | null, session: Session | null } | null, error: AuthError | null }>;
	signInWithEmail: (credentials: EmailSignInCredentials) => Promise<{ data?: { user: User | null, session: Session | null } | null, error: AuthError | null }>;
	logout: () => Promise<{ error: AuthError | null }>;
	isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};

interface AuthProviderProps {
	children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [session, setSession] = useState<Session | null>(null);
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);

	// Function to check admin status from profiles table
	const checkAdminStatus = async (userId: string | undefined) => {
		if (!userId) return false;
		const { data, error } = await supabase
			.from('profiles')
			.select('is_admin')
			.eq('id', userId)
			.maybeSingle(); // Changed from .single() to .maybeSingle()

		if (error) {
			console.error("Error fetching admin status:", error.message);
			return false;
		}
		return data?.is_admin || false;
	};

	// Sign up function
	const signUpWithEmail = async (credentials: EmailSignUpCredentials) => {
		setLoading(true);

		if (!credentials.options?.captchaToken) {
			setLoading(false);
			return { error: { message: "CAPTCHA token is missing." } as AuthError };
		}

		const { data, error } = await supabase.auth.signUp({
			email: credentials.email,
			password: credentials.password,
			options: {
				captchaToken: credentials.options.captchaToken,
				...(credentials.options?.data && { data: credentials.options.data }), // Include other options data if any
			},
		});
		// Session change will be handled by onAuthStateChange listener
		setLoading(false);
		if (error) console.error("Error signing up:", error.message);
		return { data, error } as { data: { user: User | null, session: Session | null } | null, error: AuthError | null };
	};

	// Sign in function
	const signInWithEmail = async (credentials: EmailSignInCredentials) => {
		setLoading(true);

		if (!credentials.options?.captchaToken) {
			setLoading(false);
			return { error: { message: "CAPTCHA token is missing." } as AuthError };
		}

		const { data, error } = await supabase.auth.signInWithPassword({
			email: credentials.email,
			password: credentials.password,
			options: {
				captchaToken: credentials.options.captchaToken,
			},
		});
		// Session change will be handled by onAuthStateChange listener
		setLoading(false);
		if (error) console.error("Error signing in:", error.message);
		return { data, error };
	};

	// Logout function
	const logout = async () => {
		setLoading(true);
		const { error } = await supabase.auth.signOut();
		// Session change will be handled by onAuthStateChange listener
		setLoading(false);
		if (error) console.error("Error signing out:", error.message);
		return { error };
	};

	useEffect(() => {
		setLoading(true);
		// Check for initial session
		supabase.auth.getSession().then(async ({ data: { session } }) => {
			setSession(session);
			const user = session?.user ?? null;
			setCurrentUser(user);
			const admin = await checkAdminStatus(user?.id);
			setIsAdmin(admin);
			setLoading(false); // Initial check done

			// Set up the auth state change listener
			const { data: { subscription } } = supabase.auth.onAuthStateChange(
				async (_event, session) => {
					setSession(session);
					const user = session?.user ?? null;
					setCurrentUser(user);
					const admin = await checkAdminStatus(user?.id);
					setIsAdmin(admin);
					// Don't set loading to false here again, only on initial load
				}
			);

			// Cleanup subscription on unmount
			return () => {
				subscription?.unsubscribe();
			};
		}).catch(error => {
			console.error("Error getting initial session:", error);
			setLoading(false);
		});

	}, []); // Empty dependency array ensures this runs only once on mount

	const value = {
		currentUser,
		session,
		loading,
		signUpWithEmail,
		signInWithEmail,
		logout,
		isAdmin,
	};

	return (
		<AuthContext.Provider value={value}>
			{!loading && children}
		</AuthContext.Provider>
	);
};