import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SessionReminderService } from './services/sessionReminder.service';
import App from './App';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export default function Main() {
    // Register WORKOUT_REMINDER notification category (Snooze + Dismiss buttons)
    // once at app launch so the action buttons are available before any session
    // notification fires — even if the app was just cold-started from a tap.
    useEffect(() => {
        SessionReminderService.setupCategories().catch(e =>
            console.warn('[Main] setupCategories failed:', e),
        );
    }, []);

    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor="#1d2337" />
            <App />
        </SafeAreaProvider>
    );
}
