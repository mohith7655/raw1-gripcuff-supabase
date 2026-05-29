import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export const ChallengeVideoRoom: React.FC = () => {
    const navigation = useNavigation<any>();
    return (
        <View style={styles.root}>
            <Text style={styles.text}>Live video challenges are not supported on web.</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btn}>
                <Text style={styles.btnText}>Go Back</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0a0f1a', alignItems: 'center', justifyContent: 'center', padding: 32 },
    text: { color: '#607a94', fontSize: 15, textAlign: 'center', marginBottom: 24 },
    btn: { backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
    btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
