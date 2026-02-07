import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdBanner() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>広告バナー (開発用プレースホルダー)</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 60,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#aaa',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
