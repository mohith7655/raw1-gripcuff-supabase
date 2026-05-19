import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
    fontSize?: number;
    centerAlign?: boolean;
}

export const Raw1Logo = ({ fontSize = 28, centerAlign = false }: Props) => {
    return (
        <View style={[styles.container, centerAlign ? styles.center : styles.start]}>
            <Text style={[styles.raw, { fontSize }]}>RAW</Text>
            <Text style={[styles.one, { fontSize }]}>1</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    center: {
        justifyContent: 'center',
    },
    start: {
        justifyContent: 'flex-start',
    },
    raw: {
        fontWeight: '900',
        color: '#465060', // Metal Gray
        letterSpacing: -1,
    },
    one: {
        fontWeight: '900',
        color: '#e46600', // Orange
        letterSpacing: -1,
    },
});
