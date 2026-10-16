import type { Category } from './types';
export const categories: { id: Category; name: string; label: string; description: string; color: string }[] = [
  { id: 'dsa', name: 'Data structures & algorithms', label: 'DSA', description: 'Build intuition. Solve with confidence.', color: 'blue' },
  { id: 'lld', name: 'Low-level design', label: 'LLD', description: 'Clean code. Thoughtful abstractions.', color: 'purple' },
  { id: 'hld', name: 'High-level design', label: 'HLD', description: 'Think in systems. Design for scale.', color: 'green' },
  { id: 'aws', name: 'Amazon Web Services', label: 'AWS', description: 'From cloud concepts to production.', color: 'orange' },
  { id: 'redis', name: 'Redis', label: 'Redis', description: 'Caching, data structures, and real-time systems.', color: 'rose' },
  { id: 'multithreading', name: 'Multithreading in Java', label: 'Java threads', description: 'Threads, synchronization, and concurrent code.', color: 'blue' },
  { id: 'springboot', name: 'Spring Boot', label: 'Spring Boot', description: 'Follow the framework from internals to applications.', color: 'green' },
  { id: 'kafka', name: 'Kafka & messaging queues', label: 'Kafka', description: 'Brokers, partitions, delivery, and resilience.', color: 'orange' },
  { id: 'testing', name: 'JUnit & Mockito', label: 'JUnit & Mockito', description: 'Test with clarity. Build with confidence.', color: 'purple' },
  { id: 'other', name: 'Other notes', label: 'Other', description: 'Make room for your next curiosity.', color: 'gray' },
];
