'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
    children: React.ReactNode;
}

export default function Portal({ children }: PortalProps) {
    // Portal only runs on client when triggered by user interaction, so document should be available.
    // Adding a simple guard just in case.
    if (typeof document === 'undefined') return null;

    return createPortal(children, document.body);
}
