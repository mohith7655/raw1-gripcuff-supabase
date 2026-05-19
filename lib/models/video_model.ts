export interface Video {
    id: string;
    title: string;
    duration: string;
    views: string;
    uploadDate: string;
    category: string;
    thumbnailColor: string;
}

export function getSampleVideos(): Video[] {
    return [
        {
            id: '1',
            title: 'Complete Chest Workout',
            duration: '45:00',
            views: '1.2M',
            uploadDate: '2 days ago',
            category: 'Strength',
            thumbnailColor: '#FF6B6B',
        },
        {
            id: '2',
            title: 'Leg Day Intensity',
            duration: '55:30',
            views: '856K',
            uploadDate: '5 days ago',
            category: 'Strength',
            thumbnailColor: '#4ECDC4',
        },
        {
            id: '3',
            title: 'Back & Biceps Blaster',
            duration: '40:15',
            views: '2.1M',
            uploadDate: '1 week ago',
            category: 'Strength',
            thumbnailColor: '#95E1D3',
        },
        {
            id: '4',
            title: '15 Min Box Breathing',
            duration: '15:00',
            views: '1.8M',
            uploadDate: '2 weeks ago',
            category: 'Recovery',
            thumbnailColor: '#F38181',
        },
        {
            id: '5',
            title: 'HIIT Cardio Circuit',
            duration: '25:00',
            views: '945K',
            uploadDate: '3 weeks ago',
            category: 'HIIT',
            thumbnailColor: '#AA96DA',
        },
        {
            id: '6',
            title: 'Shoulder Mobility Routine',
            duration: '12:00',
            views: '1.5M',
            uploadDate: '1 month ago',
            category: 'Mobility',
            thumbnailColor: '#FCBAD3',
        },
        {
            id: '7',
            title: 'Deadlift Form Guide',
            duration: '10:45',
            views: '678K',
            uploadDate: '1 month ago',
            category: 'Tutorial',
            thumbnailColor: '#FFFFD2',
        },
        {
            id: '8',
            title: 'Full Body Stretching',
            duration: '20:00',
            views: '1.1M',
            uploadDate: '2 months ago',
            category: 'Recovery',
            thumbnailColor: '#A8D8EA',
        },
    ];
}
