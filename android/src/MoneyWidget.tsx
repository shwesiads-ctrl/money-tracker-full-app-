import {Column,Row,Text} from '@expo/ui/jetpack-compose';
import {background,cornerRadius,fillMaxSize,fillMaxWidth,paddingAll} from '@expo/ui/jetpack-compose/modifiers';
import {createWidget} from 'expo-widgets';
export type MoneyWidgetProps={amount:string;income:string;expense:string;currency:'MMK'|'USD';isPrivate:boolean};
const MoneyWidget=({amount,income,expense,currency,isPrivate}:MoneyWidgetProps)=>{
 'widget';
 return (
  <Column modifiers={[fillMaxSize(),background('#112235'),cornerRadius(20),paddingAll(12)]} verticalArrangement={{spacedBy:4}}>
   <Row modifiers={[fillMaxWidth()]} horizontalArrangement="spaceBetween" verticalAlignment="center">
    <Text color="#4ADE80" style={{fontSize:13,fontWeight:'bold'}}>●  Money Tracker</Text>
    <Text color="#AEC5D9" style={{fontSize:10,fontWeight:'bold'}}>{isPrivate?'PRIVATE':currency}</Text>
   </Row>
   <Text color="#AFC4D8" style={{fontSize:10}}>TOTAL BALANCE</Text>
   <Text color="#FFFFFF" style={{fontSize:24,fontWeight:'bold'}} maxLines={1} overflow="ellipsis">{isPrivate?'••••••':amount}</Text>
   <Row modifiers={[fillMaxWidth()]} horizontalArrangement="spaceBetween" verticalAlignment="center">
    <Text color="#4ADE80" style={{fontSize:11,fontWeight:'bold'}} maxLines={1} overflow="ellipsis">{isPrivate?'BALANCE HIDDEN':'↑ '+income}</Text>
    {!isPrivate&&<Text color="#FB7185" style={{fontSize:11,fontWeight:'bold'}} maxLines={1} overflow="ellipsis">{'↓ '+expense}</Text>}
   </Row>
  </Column>
 );
};
export default createWidget('MoneyWidget',MoneyWidget,{amount:'',income:'',expense:'',currency:'MMK',isPrivate:true});
