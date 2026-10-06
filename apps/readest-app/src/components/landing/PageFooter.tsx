'use client';

import React from 'react';

interface PageFooterProps {
  tagline: string;
}

export const PageFooter: React.FC<PageFooterProps> = ({ tagline }) => (
  <p className='text-base-content/50 mt-6 text-center text-xs'>
    <span className='font-medium'>Readest</span>
    <span className='mx-1.5'>·</span>
    <span>{tagline}</span>
  </p>
);
