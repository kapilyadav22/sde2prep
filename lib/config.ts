import type { Category } from './types';
export const categories: { id: Category; name: string; label: string; description: string; color: string }[] = [
  { id: 'dsa', name: 'Data structures & algorithms', label: 'DSA', description: 'Build intuition. Solve with confidence.', color: 'blue' },
  { id: 'lld', name: 'Low-level design', label: 'LLD', description: 'Clean code. Thoughtful abstractions.', color: 'purple' },
  { id: 'hld', name: 'High-level design', label: 'HLD', description: 'Think in systems. Design for scale.', color: 'green' },
  { id: 'aws', name: 'Amazon Web Services', label: 'AWS', description: 'From cloud concepts to production.', color: 'orange' },
  { id: 'other', name: 'Other notes', label: 'Other', description: 'Make room for your next curiosity.', color: 'gray' },
];
