"use client";

import { useState, useEffect } from "react";

export default function ETFPlaybook() {
  const [events, setEvents] = useState([]);

  // Load saved data
  useEffect(() => {
    try {
      const saved = localStorage.getItem("etf_events_full");
      if (saved) setEvents(JSON.parse(saved));
    } catch {}
  }, []);

  // Save data
  useEffect(() => {
    try {
      localStorage.setItem("etf_events_full", JSON.stringify(events));
    } catch {}
  }, [events]);

  function addEvent() {
    const newEvent = {
      id: Date.now(),
      name: "New Event",
      type: "Sports",

      attendees: "",
      nights: "",
      outOfMarket: "",

      adr: "140",
      hotRate: "7",

      incentive: "",
      venueCost: "",
      notes: "",

      confidence: "Medium",
    };

    setEvents([newEvent, ...events]);
  }

  function deleteEvent(id) {
    setEvents(events.filter((e) => e.id !== id));
  }

  function updateEvent(id, field, value) {
    setEvents(
      events.map((e) =>
        e.id === id ? { ...e, [field]: value } : e
      )
    );
  }

  function calculate(e) {
    const attendees = Number(e.attendees) || 0;
    const nights = Number(e.nights) || 0;
    const outOfMarket = Number(e.outOfMarket) || 0;

    const adr = Number(e.adr) || 0;
    const hotRate = (Number(e.hotRate) || 0) / 100;

    const incentive = Number(e.incentive) || 0;
    const venueCost = Number(e.venueCost) || 0;

    const roomNights = attendees * nights;
    const qualifiedNights = roomNights * (outOfMarket / 100);

    const hotelRevenue = qualifiedNights * adr;
    const hotRevenue = hotelRevenue * hotRate;

    const totalCost = incentive + venueCost;

    const roi =
      totalCost > 0 ? (hotRevenue / totalCost).toFixed(2) : "0.00";

    let decision = "NO-GO";
    let color = "#991b1b";

    if (Number(roi) > 4) {
      decision = "STRONG GO";
      color = "#065f46";
    } else if (Number(roi) > 2.5) {
      decision = "GO";
      color = "#166534";
    } else if (Number(roi) > 1.25) {
      decision = "MAYBE";
      color = "#92400e";
    }

    return {
      roomNights,
      qualifiedNights,
      hotelRevenue,
      hotRevenue,
      totalCost,
      roi,
      decision,
      color,
    };
  }
