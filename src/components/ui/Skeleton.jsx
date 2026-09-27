import React from 'react';

export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#E5E7EB] ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3 p-5 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB]">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function SkeletonWidget() {
  return (
    <div className="card p-5 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB] space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    </div>
  );
}
