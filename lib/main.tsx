import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';
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
    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor="#1d2337" />
            <App />
        </SafeAreaProvider>
    );
}
