// src/components/common/PackageActions.tsx
import React from 'react';
import { Stack } from '@mui/material';
import { Code as CodeIcon, Article, Language, Link as LinkIconMui } from '@mui/icons-material';
import { Package } from '../../types'; // Adjust path as needed
import PackageLinkButton from './PackageLinkButton';

interface PackageActionsProps {
    pkg: Package;
    direction?: "row" | "column"; // Optional: to allow different layouts if needed
    spacing?: number;
}

const PackageActions: React.FC<PackageActionsProps> = ({ pkg, direction = "row", spacing = 1 }) => {
    return (
        <Stack direction={direction} spacing={spacing} sx={{ flexWrap: 'wrap', gap: direction === "row" ? 1 : 0.5 }}>
            {(pkg.repo_link || pkg.repository) && (
                <PackageLinkButton
                    href={pkg.repo_link || pkg.repository || ''}
                    icon={<CodeIcon fontSize="small" />}
                    label="Code"
                    tooltipTitle="Code Repository"
                />
            )}
            {pkg.publication && (
                <PackageLinkButton
                    href={pkg.publication}
                    icon={<Article fontSize="small" />}
                    label="Publication"
                    tooltipTitle="Publication"
                />
            )}
            {pkg.webserver && (
                <PackageLinkButton
                    href={pkg.webserver}
                    icon={<Language fontSize="small" />}
                    label="Web"
                    tooltipTitle="Webserver"
                />
            )}
            {pkg.link && (
                <PackageLinkButton
                    href={pkg.link}
                    icon={<LinkIconMui fontSize="small" />}
                    label="Link"
                    tooltipTitle="External Link"
                />
            )}
        </Stack>
    );
};

export default PackageActions;