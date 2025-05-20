// src/components/common/PackageMetrics.tsx
import React from 'react';
import { Stack } from '@mui/material';
import { FiStar, FiClock, FiBookOpen } from 'react-icons/fi';
import { Package } from '../../types'; // Adjust path as needed
import PackageInfoChip from './PackageInfoChip';

interface PackageMetricsProps {
    pkg: Package;
    variant?: 'card' | 'list'; // Pass down to PackageInfoChip
    direction?: "row" | "column";
    spacing?: number;
}

const formatLastCommitAgo = (lastCommitAgo?: string): string => {
    if (!lastCommitAgo) return '';
    return lastCommitAgo
        .replace(' months ago', 'mo')
        .replace(' days ago', 'd')
        .replace(' hours ago', 'h')
        .replace(' minutes ago', 'm')
        .replace(' seconds ago', 's');
};

const PackageMetrics: React.FC<PackageMetricsProps> = ({ pkg, variant = 'card', direction = "row", spacing = 1 }) => {
    const showMetrics = (typeof pkg.github_stars !== 'undefined' && pkg.github_stars > 0) ||
                        pkg.last_commit_ago ||
                        (typeof pkg.citations !== 'undefined' && pkg.citations >= 0);

    if (!showMetrics) return null;

    return (
        <Stack direction={direction} spacing={spacing} sx={{ flexWrap: 'wrap', justifyContent: variant === 'list' ? 'flex-end' : 'flex-start', gap: 0.75 }}>
            {typeof pkg.github_stars !== 'undefined' && pkg.github_stars > 0 && (
                <PackageInfoChip
                    icon={<FiStar size={14} />}
                    label={pkg.github_stars}
                    tooltipTitle="GitHub Stars"
                    iconColor="warning.main"
                    variant={variant}
                />
            )}
            {pkg.last_commit_ago && (
                <PackageInfoChip
                    icon={<FiClock size={14} />}
                    label={formatLastCommitAgo(pkg.last_commit_ago)}
                    tooltipTitle="Last Commit"
                    iconColor="info.main"
                    variant={variant}
                />
            )}
            {typeof pkg.citations !== 'undefined' && pkg.citations >= 0 && (
                <PackageInfoChip
                    icon={<FiBookOpen size={14} />}
                    label={pkg.citations}
                    tooltipTitle="Citations"
                    iconColor="success.main"
                    variant={variant}
                />
            )}
        </Stack>
    );
};

export default PackageMetrics;