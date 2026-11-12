import * as ImagePicker from 'expo-image-picker';
import {File,Directory,Paths} from 'expo-file-system';
import type {SQLiteDatabase} from 'expo-sqlite';
import {putReceipt,removeReceipt} from './featureDb';
export async function attachReceipt(db:SQLiteDatabase,txId:string){
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:0.55,selectionLimit:1});
 if(result.canceled||!result.assets[0])return false;
 const asset=result.assets[0],origin=new File(asset.uri);
 if(!origin.exists||origin.size>2*1024*1024)throw new Error('Choose a receipt photo smaller than 2 MB');
 const mime=asset.mimeType==='image/png'?'image/png':'image/jpeg';
 const dir=new Directory(Paths.document,'receipts');dir.create({idempotent:true,intermediates:true});
 const target=new File(dir,`receipt_${txId.replace(/[^a-zA-Z0-9_-]/g,'')}_${Date.now()}.${mime==='image/png'?'png':'jpg'}`);
 origin.copy(target);
 try{await putReceipt(db,txId,target.uri,mime);}catch(e){if(target.exists)target.delete();throw e;}
 return true;
}
export async function deleteReceipt(db:SQLiteDatabase,txId:string,oldUri:string){
 await removeReceipt(db,txId);
 // Only unlink files from the app-owned receipts folder.
 if(!oldUri.includes('/receipts/'))return;
 try{const f=new File(oldUri);if(f.exists)f.delete();}catch{}
}
