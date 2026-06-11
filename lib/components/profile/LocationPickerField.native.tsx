import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Platform,
    SafeAreaView,
    TouchableWithoutFeedback,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { MapPin, X } from 'lucide-react-native';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
if (!API_KEY) console.warn('LocationPickerField: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set');

export type LocationValue = {
    address: string;
    placeName?: string;
    placeId?: string;
    lat: number;
    lng: number;
};

type Props = {
    value: LocationValue | null;
    onChange: (loc: LocationValue) => void;
};

export function LocationPickerField({ value, onChange }: Props) {
    const [modalVisible, setModalVisible] = useState(false);
    const autocompleteRef = useRef<any>(null);

    return (
        <>
            <TouchableOpacity
                style={styles.fieldInput}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.7}
            >
                <MapPin color={value ? '#F25912' : '#7A7C90'} size={16} style={styles.pin} />
                <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
                    {value ? value.address : 'Search your location'}
                </Text>
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                    <View style={styles.overlay} />
                </TouchableWithoutFeedback>

                <View style={styles.sheet}>
                    <SafeAreaView style={styles.sheetInner}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Search Location</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                                <X color="#211832" size={20} />
                            </TouchableOpacity>
                        </View>

                        <GooglePlacesAutocomplete
                            ref={autocompleteRef}
                            placeholder="Search your location"
                            fetchDetails
                            minLength={2}
                            debounce={300}
                            query={{ key: API_KEY, language: 'en' }}
                            onPress={(data, details) => {
                                onChange({
                                    address: details?.formatted_address || data.description,
                                    placeName: details?.name || data.description.split(',')[0]?.trim(),
                                    placeId: data.place_id,
                                    lat: details?.geometry?.location?.lat ?? 0,
                                    lng: details?.geometry?.location?.lng ?? 0,
                                });
                                setModalVisible(false);
                            }}
                            styles={{
                                container: { flex: 0 },
                                textInputContainer: styles.autocompleteInputContainer,
                                textInput: styles.autocompleteInput,
                                listView: styles.listView,
                                row: styles.resultRow,
                                description: styles.resultText,
                                separator: styles.separator,
                            }}
                            enablePoweredByContainer={false}
                            keepResultsAfterBlur
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </>
    );
}

const SHEET_BG = '#F8F8FC';

const styles = StyleSheet.create({
    fieldInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.1)',
        gap: 8,
    },
    pin: {
        marginRight: 2,
    },
    fieldText: {
        flex: 1,
        fontSize: 15,
        color: '#211832',
    },
    placeholder: {
        color: '#7A7C90',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: SHEET_BG,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        minHeight: Platform.OS === 'ios' ? 480 : 520,
        paddingBottom: Platform.OS === 'ios' ? 0 : 16,
    },
    sheetInner: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    sheetTitle: {
        color: '#211832',
        fontSize: 16,
        fontWeight: '700',
    },
    closeBtn: {
        padding: 4,
    },
    autocompleteInputContainer: {
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        borderBottomWidth: 0,
        paddingHorizontal: 0,
    },
    autocompleteInput: {
        backgroundColor: '#F8F8FC',
        borderRadius: 10,
        color: '#211832',
        fontSize: 15,
        paddingHorizontal: 14,
        height: 46,
        borderWidth: 1,
        borderColor: '#D8D8E4',
    },
    listView: {
        backgroundColor: '#F8F8FC',
        borderRadius: 10,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#D8D8E4',
    },
    resultRow: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    resultText: {
        color: '#211832',
        fontSize: 14,
    },
    separator: {
        height: 1,
        backgroundColor: '#D8D8E4',
    },
});
