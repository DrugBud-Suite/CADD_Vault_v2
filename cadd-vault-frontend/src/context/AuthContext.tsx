// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabase'; // Import Supabase client
import { Session, User, AuthError, SignUpWithPasswordCredentials } from '@supabase/supabase-js'; // Import Supabase types

// Re-defining EmailSignUpCredentials as it was in the original file,
// Supabase's SignUpWithPasswordCredentials might not directly match if custom options were expected.
// However, it's better to align with Supabase types if possible.
// For this example, I'll use the interface as defined in your original file.
interface EmailSignUpCredentials {
	email: string;
	password: string;
	options?: {
		data?: object;
		captchaToken?: string;
		channel?: "sms" | "whatsapp"; // Optional: if you were using phone signup elsewhere
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
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState<boolean>(true); // Start loading as true
	const [isAdmin, setIsAdmin] = useState<boolean>(false);

	// Updated function to check admin status by calling the RPC function
	const checkAdminStatus = async (userId: string | undefined): Promise<boolean> => {
		if (!userId) {
			setIsAdmin(false); // Explicitly set isAdmin to false if no user
			return false;
		}
		try {
			// console.log("Calling is_current_user_admin RPC for user:", userId);
			const { data, error } = await supabase.rpc('is_current_user_admin');

			if (error) {
				console.error("Error calling is_current_user_admin RPC:", error.message);
				setIsAdmin(false); // Set to false on error
				return false;
			}
			// The RPC function returns a boolean directly
			const adminStatus = data === true;
			// console.log("Admin status from RPC:", adminStatus);
			setIsAdmin(adminStatus); // Update state
			return adminStatus;

		} catch (e: any) {
			console.error("Exception calling is_current_user_admin RPC:", e.message);
			setIsAdmin(false); // Set to false on exception
			return false;
		}
	};

	useEffect(() => {
		setLoading(true);
		// Check for initial session
		supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
			setSession(initialSession);
			const user = initialSession?.user ?? null;
			setCurrentUser(user);
			await checkAdminStatus(user?.id); // Await the admin status check
			setLoading(false); // Initial check done

			// Set up the auth state change listener
			const { data: { subscription } } = supabase.auth.onAuthStateChange(
				async (_event, currentSession) => {
					setSession(currentSession);
					const currentUserFromEvent = currentSession?.user ?? null;
					setCurrentUser(currentUserFromEvent);
					// No need to setLoading(true) here as it might cause flashes,
					// admin status will update reactively.
					await checkAdminStatus(currentUserFromEvent?.id); // Await the admin status check
				}
			);

			// Cleanup subscription on unmount
			return () => {
				subscription?.unsubscribe();
			};
		}).catch(error => {
			console.error("Error getting initial session:", error);
			setIsAdmin(false); // Ensure isAdmin is false on error
			setCurrentUser(null);
			setSession(null);
			setLoading(false);
		});

	}, []); // Empty dependency array ensures this runs only once on mount

	const signUpWithEmail = async (credentials: EmailSignUpCredentials) => {
		setLoading(true);
	// Use Supabase's SignUpWithPasswordCredentials type for the actual call if appropriate
		const { data, error } = await supabase.auth.signUp({
			email: credentials.email,
			password: credentials.password,
			options: {
				captchaToken: credentials.options?.captchaToken,
				// `data` in options is for user_metadata, ensure it's structured correctly if used
				// For now, keeping it simple based on your interface.
			}
		} as SignUpWithPasswordCredentials); // Type assertion may be needed if interfaces differ
		setLoading(false);
		if (error) {
			console.error("Error signing up:", error.message);
		}
		// Session change will be handled by onAuthStateChange listener, which also calls checkAdminStatus
		return { data, error };
	};

	const signInWithEmail = async (credentials: EmailSignInCredentials) => {
		setLoading(true);
		const { data, error } = await supabase.auth.signInWithPassword(credentials);
		setLoading(false);
		if (error) {
			console.error("Error signing in:", error.message);
		}
		// Session change will be handled by onAuthStateChange listener, which also calls checkAdminStatus
		return { data, error };
	};

	const logout = async () => {
		setLoading(true);
		const { error } = await supabase.auth.signOut();
		// Session and user state will be cleared by onAuthStateChange listener
		// which will also set isAdmin to false via checkAdminStatus(null)
		setLoading(false);
		if (error) console.error("Error signing out:", error.message);
		return { error };
	};

	const value = {
		currentUser,
		session,
		loading,
		signUpWithEmail,
		signInWithEmail,
		logout,
		isAdmin,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};