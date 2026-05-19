/**
 * AgoraVideoRoom.web.tsx
 *
 * Web platform-specific screen (auto-selected by Metro over AgoraVideoRoom.tsx on web).
 * Thin navigation wrapper around the LiveCamera component.
 *
 * Navigate to this screen exactly the same way as the native version:
 *   navigation.navigate('AgoraVideoRoom', { channelName, participantName, token })
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LiveCamera } from '../components/LiveCamera.web';

export const AgoraVideoRoom: React.FC = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { channelName = 'default', token } = route.params ?? {};

    return (
        <View style={styles.root}>
            <LiveCamera
                channelName={channelName}
                token={token ?? null}
                onLeave={() => navigation.goBack()}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0d1520' },
});
