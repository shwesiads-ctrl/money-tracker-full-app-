import {Column,Text} from '@expo/ui/jetpack-compose';
import {background,cornerRadius,fillMaxSize,paddingAll} from '@expo/ui/jetpack-compose/modifiers';
import {createWidget} from 'expo-widgets';
export type MoneyWidgetSmallProps={amount:string;currency:'MMK'|'USD';isPrivate:boolean};
const MoneyWidgetSmall=({amount,currency,isPrivate}:MoneyWidgetSmallProps)=>{
 'widget';
 return (
  <Column modifiers={[fillMaxSize(),background('#112235'),cornerRadius(20),paddingAll(12)]} verticalArrangement={{spacedBy:6}}>
   <Text color="#4ADE80" style={{fontSize:12,fontWeight:'bold'}} maxLines={1} overflow="ellipsis">●  Money Tracker</Text>
   <Text color="#AFC4D8" style={{fontSize:10}}>TOTAL BALANCE</Text>
   <Text color="#FFFFFF" style={{fontSize:21,fontWeight:'bold'}} maxLines={1} overflow="ellipsis">{isPrivate?'••••••':amount}</Text>
   <Text color="#4ADE80" style={{fontSize:10,fontWeight:'bold'}}>{isPrivate?'PRIVATE MODE':currency}</Text>
  </Column>
 );
};
export default createWidget('MoneyWidgetSmall',MoneyWidgetSmall,{amount:'',currency:'MMK',isPrivate:true});
