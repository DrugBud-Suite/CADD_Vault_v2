import React from 'react';
import { Container, Typography, Box, Grid, Card, CardContent, Avatar, Button, Chip, ButtonProps, TypographyProps } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useThemeValue } from '../components/ThemeContext';
import caddVaultDarkLogo from '../assets/caddvault_dark.png';
import caddVaultWhiteLogo from '../assets/caddvault_white.png';

// Import MUI Icons
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { styled, alpha } from '@mui/material/styles';

const AboutPage: React.FC = () => {
	const { darkMode } = useThemeValue();
	const logoSrc = darkMode ? caddVaultWhiteLogo : caddVaultDarkLogo;

	const StyledCard = styled(Card)(({ theme }) => ({
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		transition: theme.transitions.create(['transform', 'box-shadow'], {
			duration: theme.transitions.duration.enteringScreen,
		}),
		'&:hover': {
			transform: 'translateY(-8px)',
			boxShadow: `0 12px 20px -10px ${alpha(theme.palette.primary.main, 0.3)}`,
		},
		background: alpha(theme.palette.background.paper, 0.7),
		backdropFilter: 'blur(10px)',
		border: `0`,
		borderRadius: theme.shape.borderRadius * 2,
	}));

	const SectionIconAvatar = styled(Avatar)(({ theme }) => ({
		backgroundColor: theme.palette.primary.main,
		color: theme.palette.primary.contrastText,
		width: 64,
		height: 64,
		marginRight: theme.spacing(2.5),
		boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.25)}`,
	}));

	// Explicitly type SectionTitle to accept TypographyProps and a component prop
	const SectionTitle = styled(Typography)<TypographyProps & { component?: React.ElementType }>(({ theme }) => ({
		fontWeight: 'bold',
		color: theme.palette.mode === 'dark' ? theme.palette.common.white : theme.palette.text.primary,
	}));

	const SectionContentText = styled(Typography)(({ theme }) => ({
		color: theme.palette.text.secondary,
		lineHeight: 1.7,
	}));

	// Explicitly type StyledButton to accept ButtonProps and common link-related props
	const StyledButton = styled(Button)<ButtonProps & { component?: React.ElementType; to?: string; href?: string; target?: string; rel?: string }>(({ theme }) => ({
		borderRadius: theme.shape.borderRadius * 1.5,
		textTransform: 'none',
		fontWeight: 'bold',
		padding: theme.spacing(1, 2.5),
		transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
			duration: theme.transitions.duration.short,
		}),
		'&:hover': {
			transform: 'translateY(-2px)',
			boxShadow: `0 6px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
		},
	}));

	const sections = [
		{
			icon: <InfoOutlinedIcon sx={{ fontSize: 32 }} />,
			title: 'About Us',
			content: (
				<SectionContentText variant="body1" paragraph>
					The CADD Vault is dedicated to sharing resources, tools, and knowledge in the field of computer-aided drug design. Our goal is to support researchers, students, and professionals by providing a comprehensive collection of materials related to CADD.
				</SectionContentText>
			),
		},
		{
			icon: <ListAltOutlinedIcon sx={{ fontSize: 32 }} />,
			title: "What's Inside?",
			content: (
				<>
					<SectionContentText variant="body1" paragraph>
						Explore resources covering various topics in computer-aided drug design, including:
					</SectionContentText>
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
						{[
							'Molecular Modelling',
							'Databases',
							'Benchmark Datasets',
							'Docking',
							'Scoring Functions',
							'Bioinformatics Tools',
							'Reviews and Papers',
							'Tutorials', // Kept from previous
							'Software Tools' // Kept from previous
						].map(item => (
							<Chip
								key={item}
								label={item}
								size="medium" // Slightly larger chips for better readability
								sx={{
									bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
									color: 'primary.dark',
									fontWeight: 'medium',
									borderRadius: '8px', // Softer radius
									padding: theme => theme.spacing(0.5, 1.5), // More padding
									'&:hover': {
										bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
									}
								}}
							/>
						))}
					</Box>
				</>
			),
		},
		{
			icon: <HelpOutlineOutlinedIcon sx={{ fontSize: 32 }} />,
			title: 'How to Use',
			content: (
				<>
					<SectionContentText variant="body1" paragraph>
						The vault is structured into several sections, each dedicated to a specific aspect of CADD. Navigate through the repository to explore tutorials, datasets, software tools, and more.
					</SectionContentText>
					<StyledButton
						variant="contained"
						color="primary"
						href="https://github.com/AntoineLac/CADD_Vault"
						target="_blank"
						rel="noopener noreferrer"
						endIcon={<ArrowForwardIosIcon />}
					>
						Access the Vault on GitHub
					</StyledButton>
				</>
			),
		},
		{
			icon: <GroupAddOutlinedIcon sx={{ fontSize: 32 }} />,
			title: 'Contributing',
			content: (
				<>
					<SectionContentText variant="body1" paragraph>
						We welcome contributions! If you have resources, tools, tutorials, or content that would benefit the CADD field, please see our contribution guidelines for how to get involved.
					</SectionContentText>
					<StyledButton
						variant="contained"
						color="primary"
						href="https://github.com/AntoineLac/CADD_Vault/blob/main/CONTRIBUTING.md"
						target="_blank"
						rel="noopener noreferrer"
						endIcon={<ArrowForwardIosIcon />}
					>
						Contribution Guidelines
					</StyledButton>
				</>
			),
		},
		{
			icon: <AddCircleOutlineOutlinedIcon sx={{ fontSize: 32 }} />,
			title: 'Suggest a Tool or Website',
			content: (
				<>
					<SectionContentText variant="body1" paragraph>
						Request an entry via our GitHub Issues or suggest new features.
					</SectionContentText>
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}> {/* Use Box for better layout control of buttons */}
						<StyledButton
							variant="contained"
							color="primary"
							href="https://github.com/AntoineLac/CADD_Vault/issues/new/choose"
							target="_blank"
							rel="noopener noreferrer"
							endIcon={<ArrowForwardIosIcon />}
						>
							Suggest via GitHub
						</StyledButton>
						<StyledButton
							variant="outlined" // Different style for distinction
							color="primary"
							href="https://docs.google.com/forms/d/e/1FAIpQLSfl-uEyhoT2HWnumPAFKbZyj2J62kKcMU76fBg5RzD23cgnLw/viewform?usp=sf_link"
							target="_blank"
							rel="noopener noreferrer"
							endIcon={<ArrowForwardIosIcon />}
						>
							Suggest via Google Form
						</StyledButton>
					</Box>
				</>
			),
		},
		{
			icon: <GavelOutlinedIcon sx={{ fontSize: 32 }} />,
			title: 'License',
			content: (
				<>
					<SectionContentText variant="body1" paragraph>
						CADD_Vault © 2024 by Antoine Lacour is licensed under CC BY 4.0.
					</SectionContentText>
					<StyledButton
						variant="contained"
						color="primary"
						href="https://creativecommons.org/licenses/by/4.0/"
						target="_blank"
						rel="noopener noreferrer"
						endIcon={<ArrowForwardIosIcon />}
					>
						View CC BY 4.0 License
					</StyledButton>
				</>
			),
		},
		{
			icon: <FavoriteBorderOutlinedIcon sx={{ fontSize: 32 }} />,
			title: 'Acknowledgements',
			content: (
				<SectionContentText variant="body1" paragraph>
					We thank all contributors for helping build this vault and fostering an open community for CADD research and education.
				</SectionContentText>
			),
		},
	];

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
			<Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
				<Box
					component="img"
					src={logoSrc}
					alt="CADD Vault Logo"
					sx={{
						maxWidth: '100%',
						height: 'auto',
						maxHeight: { xs: 100, sm: 130, md: 160 },
						mb: 3,
						filter: darkMode ? 'drop-shadow(0 0 15px rgba(96, 165, 250, 0.5))' : 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.3))',
					}}
				/>
				<Typography variant="h1" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '2.8rem', sm: '3.5rem', md: '4rem' } }}>
					Welcome to CADD Vault
				</Typography>
				<Typography variant="h5" sx={{ maxWidth: '750px', margin: '0 auto', color: 'text.secondary', lineHeight: 1.6 }}>
					Your open-source hub for cutting-edge computer-aided drug design resources, tools, and knowledge.
				</Typography>
			</Box>

			<Grid container spacing={5} alignItems="stretch">
				{sections.map((section, index) => (
					<Grid item xs={12} md={6} key={index}>
						<StyledCard>
							<CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: { xs: 2.5, md: 3.5 } }}>
								<Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
									<SectionIconAvatar>
										{section.icon}
									</SectionIconAvatar>
									<SectionTitle variant="h5" component="h2">
										{section.title}
									</SectionTitle>
								</Box>
								<Box sx={{ flexGrow: 1 }}>
									{section.content}
								</Box>
							</CardContent>
						</StyledCard>
					</Grid>
				))}
			</Grid>

			<Box sx={{ textAlign: 'center', mt: { xs: 8, md: 12 }, py: { xs: 4, md: 6 }, borderRadius: 3, background: (theme) => alpha(theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100], 0.7), backdropFilter: 'blur(10px)', p: { xs: 3, md: 5 }, border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.2)}` }}>
				<Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 'bold', mb: 3, color: 'primary.main' }}>
					Ready to Dive In?
				</Typography>
				<SectionContentText variant="h6" sx={{ maxWidth: '650px', margin: '0 auto', mb: 4 }}>
					Explore our curated collection of packages and accelerate your CADD projects today.
				</SectionContentText>
				<StyledButton
					variant="contained"
					color="primary"
					component={RouterLink}
					to="/"
					size="large"
					endIcon={<ArrowForwardIosIcon />}
				>
					Explore Packages
				</StyledButton>
			</Box>
		</Container>
	);
};

export default AboutPage;