// Woorkroom logo icon SVG
export function WoorkroomLogoIcon({ className = "" }: { className?: string }) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Puzzle-like icon resembling the wireframe logo */}
            <rect width="24" height="24" rx="6" fill="white" />
            <path
                d="M7 8.5C7 7.67 7.67 7 8.5 7H11V9.5C11 10.33 11.67 11 12.5 11C13.33 11 14 10.33 14 9.5V7H15.5C16.33 7 17 7.67 17 8.5V15.5C17 16.33 16.33 17 15.5 17H13V14.5C13 13.67 12.33 13 11.5 13C10.67 13 10 13.67 10 14.5V17H8.5C7.67 17 7 16.33 7 15.5V8.5Z"
                fill="#638b4b"
            />
        </svg>
    );
}
