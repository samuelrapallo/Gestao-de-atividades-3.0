import React, { useState, useEffect } from 'react';
import * as xlsx from 'xlsx';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, deleteDoc, getDocs, doc, writeBatch } from 'firebase/firestore';
import { Activity, Spreadsheet } from '../types';

export const useSpreadsheet = (sheetId?: string | null) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sheetId) {
      setActivities([]);
      setSpreadsheet(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to spreadsheet metadata
    const unsubSheet = onSnapshot(doc(db, 'spreadsheets', sheetId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setSpreadsheet({ id: docSnapshot.id, ...docSnapshot.data() } as Spreadsheet);
      } else {
        setSpreadsheet(null);
      }
    });

    // Listen to activities
    const q = query(collection(db, 'activities'), where('spreadsheetId', '==', sheetId));
    const unsubActivities = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
      setActivities(data);
      setLoading(false);
    });

    return () => {
      unsubSheet();
      unsubActivities();
    };
  }, [sheetId]);

  return { spreadsheet, activities, loading };
};

export const uploadSpreadsheet = async (file: File, adminUid: string): Promise<string> => {
  // Read Excel
  const data = await file.arrayBuffer();
  const workbook = xlsx.read(data);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet);

  // Normalize keys to find ATIVIDADES, ORDEM, DATA, EXECUTANTE
  const findKey = (row: any, searchObj: string[]) => {
    const key = Object.keys(row).find(k => searchObj.some(s => k.toUpperCase().includes(s.toUpperCase())));
    return key ? row[key] : '';
  };

  const parsedActivities = rows.map(r => ({
    atividade: findKey(r, ['ATIVIDADE', 'DESCRIPTION', 'DESC']),
    ordem: String(findKey(r, ['ORDEM', 'NUMBER', 'ID'])),
    data: findKey(r, ['DATA', 'DATE']),
    executante: findKey(r, ['EXECUTANTE', 'NAME', 'RESPONSABLE'])
  })).filter(r => r.atividade || r.executante); // simple filter for valid rows

  // Create spreadsheet doc
  const sheetRef = await addDoc(collection(db, 'spreadsheets'), {
    filename: file.name,
    createdAt: Date.now(),
    adminUid
  });

  const sheetId = sheetRef.id;

  // Batch create activities (batch limits to 500 in firestore)
  const batch = writeBatch(db);
  parsedActivities.forEach(act => {
    const docRef = doc(collection(db, 'activities'));
    batch.set(docRef, {
      spreadsheetId: sheetId,
      ...act,
      status: 'pending',
      observacoes: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  });

  await batch.commit();
  return sheetId;
};

export const deleteSpreadsheet = async (sheetId: string) => {
  const q = query(collection(db, 'activities'), where('spreadsheetId', '==', sheetId));
  const snap = await getDocs(q);

  let batch = writeBatch(db);
  let count = 0;

  // Delete all activities in chunks of 400
  for (const d of snap.docs) {
    batch.delete(d.ref);
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }

  // Delete the spreadsheet itself
  batch.delete(doc(db, 'spreadsheets', sheetId));
  await batch.commit();
};
