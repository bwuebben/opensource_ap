export default function LoadingSpinner({ message = "Loading data..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-[#334155] border-t-[#3b82f6] rounded-full animate-spin" />
      <p className="mt-4 text-[#94a3b8] text-sm">{message}</p>
    </div>
  );
}
