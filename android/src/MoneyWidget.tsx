import React from 'react';
import {Column,Text} from '@expo/ui/jetpack-compose';
import {createWidget} from 'expo-widgets';
const MoneyWidget=({headline,summary}:{headline:string;summary:string})=>{
 'widget';
 return <Column><Text>Money Tracker</Text><Text>{headline}</Text><Text>{summary}</Text></Column>;
};
export default createWidget('MoneyWidget',MoneyWidget,{headline:'Private financial tracker',summary:'Open Money Tracker to view your dashboard'});
