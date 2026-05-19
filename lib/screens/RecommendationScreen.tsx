import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function RecommendationScreen({ navigation }: any) {
    return (
        <View style={{
            flex: 1,
            backgroundColor: '#0d1520',
        }}>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#1c3a56',
                position: 'relative',
            }}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ position: 'absolute', left: 16, zIndex: 1 }}
                >
                    <Text style={{
                        color: '#D4622A',
                        fontSize: 15,
                        fontWeight: '600',
                    }}>← Back</Text>
                </TouchableOpacity>
                <Text style={{
                    flex: 1,
                    color: '#ffffff',
                    fontSize: 17,
                    fontWeight: '700',
                    textAlign: 'center',
                }}>Recommendation</Text>
            </View>

            {/* Coming Soon */}
            <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 32,
            }}>
                <Text style={{ fontSize: 64, marginBottom: 24 }}>🚀</Text>
                <Text style={{
                    color: '#ffffff',
                    fontSize: 26,
                    fontWeight: '800',
                    marginBottom: 12,
                    textAlign: 'center',
                }}>Coming Soon</Text>
                <Text style={{
                    color: '#607a94',
                    fontSize: 15,
                    textAlign: 'center',
                    lineHeight: 22,
                }}>
                    Personalized workout recommendations{'\n'}
                    based on your goals are on the way!
                </Text>
                <View style={{
                    marginTop: 32,
                    backgroundColor: '#131f2e',
                    borderRadius: 12,
                    padding: 16,
                    width: '100%',
                    borderWidth: 1,
                    borderColor: '#1c3a56',
                }}>
                    <Text style={{
                        color: '#D4622A',
                        fontSize: 13,
                        fontWeight: '600',
                        textAlign: 'center',
                    }}>
                        🔔 We'll notify you when it's ready
                    </Text>
                </View>
            </View>
        </View>
    );
}
