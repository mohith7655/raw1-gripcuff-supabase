import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
    fontSize?: number;
    centerAlign?: boolean;
    /** Drop the white background box (used for thumbnail watermarks). */
    transparent?: boolean;
}

export const Raw1Logo = ({ fontSize = 28, centerAlign = false, transparent = false }: Props) => {
    return (
        <View style={[styles.container, centerAlign ? styles.center : styles.start, transparent && styles.transparent]}>
            <Text style={[styles.raw, { fontSize }, transparent && { color: '#FFFFFF' }]}>RAW</Text>
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
    transparent: {
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    raw: {
        fontWeight: '900',
        color: '#7A7C90', // Metal Gray
        letterSpacing: -1,
    },
    one: {
        fontWeight: '900',
        color: '#F25912', // Orange
        letterSpacing: -1,
    },
});
