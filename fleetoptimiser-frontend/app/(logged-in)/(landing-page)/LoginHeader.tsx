export default function LoginHeader({ lastLogin, isLoading }: { lastLogin?: string; isLoading: boolean }) {
    return (
        <div>
            <h2>Velkommen til FleetOptimiser</h2>
            {!isLoading && lastLogin && <span className="text-sm text-gray-500">Dit seneste besøg var {new Date(lastLogin).toLocaleString()}</span>}
        </div>
    );
}
