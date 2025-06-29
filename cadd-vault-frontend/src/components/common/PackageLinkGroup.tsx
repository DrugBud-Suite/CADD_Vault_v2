import React from 'react';
import { Stack } from '@mui/material';
import { Code as CodeIcon, Article, Language, Link as LinkIcon } from '@mui/icons-material';
import PackageLinkButton from './PackageLinkButton';
import { Package } from '../../types';

interface PackageLinkGroupProps {
  package: Package;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
}

export const PackageLinkGroup: React.FC<PackageLinkGroupProps> = ({
  package: pkg,
  orientation = 'horizontal',
  size = 'small'
}) => {
  const links = [
    { href: pkg.repo_link, icon: <CodeIcon />, label: 'Repository' },
    { href: pkg.publication, icon: <Article />, label: 'Publication' },
    { href: pkg.webserver, icon: <Language />, label: 'Webserver' },
    { href: pkg.link, icon: <LinkIcon />, label: 'Other' },
  ].filter(link => link.href) as Array<{ href: string; icon: React.ReactElement; label: string }>;
  
  return (
    <Stack direction={orientation === 'horizontal' ? 'row' : 'column'} spacing={1}>
      {links.map((link) => (
        <PackageLinkButton key={link.label} {...link} size={size} />
      ))}
    </Stack>
  );
};