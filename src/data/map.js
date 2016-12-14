
//----------------------------------------------------------------------
//--------------------------DOJO Javascript-----------------------------
//----------------------------------------------------------------------


require(["dojo/_base/array", "dojo/dom", "dijit/registry", "dojo/dom-class", "dojo/hash", "dojo/number"], function(array, dom, registry, domClass, hash, number) {
    changeSetting = function() {
        initSettings(settings.lang);
        if (settings.region.length === 1) {
            dojo.query(".taskChckBox").forEach(function(node) {
                var widget = dijit.getEnclosingWidget(node);
                if (widget.checked) {
                    widget.readOnly = true;
                }
            });
        } else {
            dojo.query(".taskChckBox").forEach(function(node) {
                var widget = dijit.getEnclosingWidget(node);
                widget.readOnly = false;
            });
        }
    };

    initSettings = function(lang) {
        var form = registry.byId("settingForm");
        var learn = settings ? settings.learn : false;
        settings = form.get("value");
        settings.learn = learn;
        settings.answered = false;
        if (lang) {
            settings.lang = lang;
        } else if (!settings.lang) {
            settings.lang = "eng";
        }
        if (settings.taskStyle.indexOf("flags") !== -1) {
            domClass.add("taskDiv", "flagTask");
        } else {
            domClass.remove("taskDiv", "flagTask");
        }
        restart();
    };

    filterDataByCriteria = function() {
        filteredData = dojo.filter(countryData.features, function(item) {
            var region = settings.region.indexOf(item.region) !== -1;
            if (item.region instanceof Array) {
                dojo.forEach(item.region, function(regionItem) {
                    if (settings.region.indexOf(regionItem) !== -1) {
                        region = true;
                    }
                });
            }
            return region &&
                    item.area <= settings.maxArea &&
                    item.area >= settings.minArea;
        });
        initializeTask();
    };

    initializeTask = function() {
        wrongGuess = 0;
        var taskSpan = dom.byId("taskSpan");
        var taskInfoSpan = dom.byId("taskInfoSpan");
        if (correctAnswers.length !== filteredData.length) {
            var country = getRandomCountry();
            var taskSpanValue = "";
            if (settings && nls[settings.lang].Click) {
                taskInfoSpan.innerHTML = nls[settings.lang].Click;
            } else {
                taskInfoSpan.innerHTML = nls.eng.Click;
            }
            if (settings.taskStyle.indexOf("flags") !== -1) {
                taskSpanValue += "<img class='whiteBorder' src='http://www.geonames.org/flags/x/" + country.cca2.toLowerCase() + ".gif' height='60px'/> &nbsp;";
            }
            if (settings.taskStyle.indexOf("names") !== -1) {
                if (country.name.translations[settings.lang]) {
                    taskSpanValue += country.name.translations[settings.lang];
                } else {
                    taskSpanValue += country.name.common;
                }
            }
            if (settings.capitalStyle.indexOf("capital") !== -1) {
                if (settings.taskStyle.indexOf("names") !== -1
                        || settings.taskStyle.indexOf("flags") !== -1) {
                    taskSpanValue += "&nbsp - &nbsp";
                }
                if (country.capital.translations[settings.lang]) {
                    taskSpanValue += country.capital.translations[settings.lang];
                } else {
                    taskSpanValue += country.capital.official;
                }
            }
            taskSpan.innerHTML = taskSpanValue;
            taskCountry = country;
        } else {
            settings.answered = true;
            taskInfoSpan.innerHTML = "";
            if (settings && nls[settings.lang].AllAnswered) {
                taskSpan.innerHTML = nls[settings.lang].AllAnswered;
            } else {
                taskSpan.innerHTML = nls.eng.AllAnswered;
            }
            finalDialog.show();
        }
    };

    getRandomCountry = function() {
        var randomNum = Math.floor(Math.random() * filteredData.length);
        var country = filteredData[randomNum];
        if (correctAnswers.indexOf(country.ccn3) !== -1 || country.ccn3 === "") {
            country = getRandomCountry();
        }
        return country;
    };

    showHintFeature = function() {
        var alreadyPainted = false;
        var mainFeature = array.filter(vectorLayer.getSource().getFeatures(), function(feature) {
            if (feature.get(UNCODE) === taskCountry.ccn3) {
                return feature.mainFeature;
            }
        });
        array.forEach(hintFeature.getSource().getFeatures(), function(feature) {
            if (feature === mainFeature[0]) {
                alreadyPainted = true;
            }
        });
        if (!alreadyPainted) {
            if (taskCountry.area < 6000) {
                var coor = ol.extent.getCenter(mainFeature[0].getGeometry().getExtent());
                var circle = new ol.geom.Circle(coor, 70000, 'XY');
                var cFeature = new ol.Feature({geometry: circle});
                cFeature.set(UNCODE, mainFeature[0].get(UNCODE));
                cFeature.parentFeature = mainFeature[0];
                cFeature.mainFeature = false;
                hintFeature.getSource().addFeature(cFeature);
            } else {
                array.forEach(mainFeature[0].childFeatures, function(childFeature) {
                    hintFeature.getSource().addFeature(childFeature);
                });
            }
        }
    };

    correctAnswerAnimate = function(fill, feature) {
        var interval = 25;
        var timer = new dojox.timing.Timer(interval);
        timer.alpha = 0.5;
        timer.tickCount = 0;
        timer.fill = fill;
        timer.feature = feature;
        timer.onTick = function() {
            timer.tickCount++;
            var alpha = timer.alpha - (timer.alpha / interval * timer.tickCount);
            timer.fill.setColor('rgba(0, 255, 0, ' + alpha + ')');

            correctAnswerFeature.getSource().removeFeature(feature);
            correctAnswerFeature.getSource().addFeature(feature);

            if (alpha === 0) {
                correctAnswerFeature.getSource().removeFeature(feature);
                timer.fill.setColor('rgba(0, 255, 0, ' + timer.alpha + ')');
                timer.stop();
            }
        };
        timer.start();
    };

    wrongAnswerAnimate = function(wrongAnswerFeature, nameFeature, featureList, cFeature) {
        var interval = 25;
        var timer = new dojox.timing.Timer(interval);
        timer.alpha = 0.5;
        timer.tickCount = 0;
        timer.fill = wrongAnswerFeature.getStyle().getFill();
        if (nameFeature) {
            timer.nameTextFill = nameFeature.getStyle().getText().getFill();
            timer.nameTextStroke = nameFeature.getStyle().getText().getStroke();
        }
        timer.onTick = function() {
            this.tickCount++;
            var alpha = this.alpha - (this.alpha / interval * this.tickCount);
            this.fill.setColor('rgba(255, 0, 0, ' + alpha + ')');
            var that = this;
            dojo.forEach(featureList, function(feature) {
                if (alpha === 0 && feature) {
                    that.fill.setColor('rgba(255, 0, 0, 0)');
                    destroyLayer(wrongAnswerFeature);
                    if (that.isRunning) {
                        that.stop();
                    }
                }
                wrongAnswerFeature.getSource().removeFeature(feature);
                wrongAnswerFeature.getSource().addFeature(feature);
            });
            if (nameFeature) {
                if (alpha === 0) {
                    that.nameTextFill.setColor('rgba(255, 255, 255, 0)');
                    that.nameTextStroke.setColor('rgba(0, 0, 0, 0)');
                    destroyLayer(nameFeature);
                }
                this.nameTextFill.setColor('rgba(255, 255, 255, ' + alpha * 2 + ')');
                this.nameTextStroke.setColor('rgba(0, 0, 0, ' + alpha * 2 + ')');
                nameFeature.getSource().removeFeature(cFeature);
                nameFeature.getSource().addFeature(cFeature);
            }
        };
        timer.start();
    };

    showScore = function() {
        if (settings.answered) {
            var text = "Score: ";
            if (settings && nls[settings.lang].Score) {
                text = nls[settings.lang].Score + ": ";
            }
            var div = dojo.byId("score");
            var score = 0;
            var color = "rgb(255, 0, 0)";
            var html = "<span style='color:" + color + "'>" + text + score + "</span>";

            var finalScore = number.round(100 - (200 * wrongCounter / correctCounter), 2);
            var tmpScore = 0;
            var endAnimation = false;

            var interval = 25;
            var timer = new dojox.timing.Timer(interval);
            timer.onTick = function() {
                var c = tmpScore * 1.67;
                color = "rgb(" + Math.ceil((168 - c)) + ", " + Math.ceil((0 + c)) + ", 0)";
                html = "<span style='color:" + color + "'>" + text + tmpScore + "</span>";

                div.innerHTML = html;
                if (endAnimation) {
                    timer.stop();
                }
                tmpScore++;
                if (finalScore < tmpScore) {
                    tmpScore = finalScore < 0 ? 0 : finalScore;
                    endAnimation = true;
                }
            };
            timer.start();
            var region = settings.region.length === 5 ? "World" : settings.region.toString();
            var newDesc = "My score for " + region + " is " + finalScore + "! How about you?";

            dojo.query("[property='og:description']")[0].content = newDesc;
        }
    };

    countAnswer = function(correct) {
        if (correct) {
            var c = dom.byId('correctCount');
            correctCounter++;
            c.innerHTML = correctCounter;
        } else {
            var w = dom.byId('wrongCount');
            wrongCounter++;
            w.innerHTML = wrongCounter;
        }
    };

    resetCounter = function() {
        var c = dom.byId('correctCount');
        var w = dom.byId('wrongCount');
        c.innerHTML = "0";
        w.innerHTML = "0";
        wrongCounter = 0;
        correctCounter = 0;
    };

    localizeText = function() {
        dojo.query("span[localization]").forEach(function(span) {
            var l = dojo.attr(span, "localization");
            var v;
            if (nls[settings.lang][l]) {
                v = nls[settings.lang][l];
            } else {
                v = nls.eng[l];
            }
            span.innerHTML = v;
        });
        if (nls[settings.lang].Settings) {
            dijit.byId("settingPane").set("title", nls[settings.lang].Settings);
        } else {
            dijit.byId("settingPane").set("title", nls["eng"].Settings);
        }
        hash(settings.lang);
    };
});

//----------------------------------------------------------------------
//--------------------------Plain Javascript----------------------------
//----------------------------------------------------------------------

nls = {
    "eng": {
        "CountryArea": "Country area:",
        "Minimum": "Minimum",
        "Maximum": "Maximum",
        "HighlightAnswer": "Keep correct answer highlighted",
        "NameTask": "Show name task",
        "FlagTask": "Show flag task",
        "CapitalCity": "Show capital city",
        "HintStart": "Show a hint after",
        "HintEnd": "wrong guesses",
        "America": "North and South America",
        "Europe": "Europe",
        "Australia": "Australia",
        "Asia": "Asia",
        "Africa": "Africa",
        "SimpleMode": "Simple Mode",
        "SatelliteMode": "Sattelite Mode",
        "GodMode": "GOD Mode",
        "LearnMode": "Learn Mode",
        "Settings": "Settings",
        "Correct": "Correct",
        "Wrong": "Wrong",
        "Click": "Click on:",
        "Restart": "Restart",
        "AllAnswered": "All answered",
        "NextTask": "Next Task",
        "Score": "Score",
        "Congratulation": "Congratulation"
    },
    "slk": {
        "CountryArea": "Rozloha:",
        "HighlightAnswer": "Ponechaj označené správne odpovede",
        "NameTask": "Úloha s menom krajiny",
        "FlagTask": "Úloha s vlajkou krajiny",
        "CapitalCity": "Úloha s hlavným mestom",
        "HintStart": "Zobraz nápovedu po",
        "HintEnd": "zlých tipoch",
        "America": "Severná a Južná Amerika",
        "Europe": "Európa",
        "Australia": "Austrália",
        "Asia": "Ázia",
        "Africa": "Afrika",
        "SimpleMode": "Jednoduchý Mód",
        "SatelliteMode": "Satelitný Mód",
        "GodMode": "GOD Mód",
        "LearnMode": "Mód Učenia",
        "Settings": "Nastavenia",
        "Correct": "Správne",
        "Wrong": "Nesprávne",
        "Click": "Klikni na:",
        "Restart": "Reštart",
        "AllAnswered": "Všetko zodpovedané",
        "NextTask": "Ďalšia úloha",
        "Score": "Výsledok",
        "Congratulation": "Blahoželám!"
    },
    "ces": {
        "CountryArea": "Rozloha krajiny",
        "Minimum": "Minimum",
        "Maximum": "Maximum",
        "HighlightAnswer": "Držet správnou odpověď vyznačen",
        "NameTask": "Úkol se zobrazením názvu",
        "FlagTask": "Úkol se zobrazením vlajek",
        "CapitalCity": "Zobraz hlavní město",
        "HintStart": "Zobraz nápovědu po",
        "HintEnd": "špatních odhadech",
        "America": "Severní a Jižná Amerika",
        "Europe": "Evropa",
        "Australia": "Austrálie",
        "Asia": "Asie",
        "Africa": "Afrika",
        "SimpleMode": "Jednoduchý mód",
        "SatelliteMode": "Satelitní mód",
        "GodMode": "GOD mód",
        "LearnMode": "Učíci mód",
        "Settings": "Nastavení",
        "Correct": "Správně:",
        "Wrong": "Špatně:",
        "Click": "Klikni na",
        "Restart": "Restartuj",
        "AllAnswered": "Vše zodpovedané",
        "NextTask": "Další úkol",
        "Score": "Výsledek",
        "Congratulation": "Gratuluji!"
    },
    "spa": {
        "CountryArea": "Superficie del país:",
        "Minimum": "Mínimo",
        "Maximum": "Máximo",
        "HighlightAnswer": "Mantenga respuesta correcta destacado",
        "NameTask": "Mostrar nombre de tarea",
        "FlagTask": "Mostrar tarea bandera",
        "CapitalCity": "Mostrar la capital",
        "HintStart": "Mostró un poco después de ",
        "HintEnd": "intentos incorrectos",
        "America": "Norte y América del Sur",
        "Europe": "Europa",
        "Africa": "África",
        "SimpleMode": "Modo simple",
        "SatelliteMode": "Modo satélite",
        "GodMode": "Modo GOD",
        "LearnMode": "Modo Aprender",
        "Settings": "Ajustes",
        "Correct": "Correcto:",
        "Wrong": "Incorrecto:",
        "Click": "Clic en",
        "Restart": "Reanudar",
        "AllAnswered": "Todo contestado",
        "NextTask": "Siguiente tarea",
        "Score": "Resultado",
        "Congratulation": "Felicitaciones!"
    },
    "deu": {
        "CountryArea": "Landesgrösse:",
        "Maximum": "Maximum",
        "Minimum": "Minimum",
        "HighlightAnswer": "Richtige Antwort angezeigt lassen",
        "NameTask": "Namen anzeigen",
        "FlagTask": "Landesflagge anzeigen",
        "CapitalCity": "Hauptstadt anzeigen",
        "HintStart": "Tipp nach ",
        "HintEnd": "falschen Antworten",
        "America": "Nord- und Südamerika",
        "Europe": "Europa",
        "Australia": "Australien",
        "Asia": "Asien",
        "Africa": "Afrika",
        "SimpleMode": "Einfacher Modus",
        "SatelliteMode": "Satelliten-Modus",
        "GodMode": "Gott-Modus",
        "LearnMode": "Lerner-Modus",
        "Settings": "Einstellungen",
        "Correct": "Richtig:",
        "Wrong": "Falsch:",
        "Click": "Klicken sie:",
        "Restart": "Neustarten",
        "AllAnswered": "Alle beantwortet",
        "NextTask": "Nächste Aufgabe",
        "Score": "Ergebnis",
        "Congratulation": "Glückwunsch!"
    },
    "fra": {
        "CountryArea": "Superficie:",
        "Minimum": "Minimum",
        "HighlightAnswer": "Laisser les réponses correctes en surbrillance",
        "NameTask": "Nom du pays",
        "FlagTask": "Drapeau du pays",
        "CapitalCity": "Capitale du pays",
        "HintStart": "Afficher un indice après ",
        "HintEnd": "suppositions erronées",
        "America": "Amérique du Nord et Sud",
        "Australia": "Australie",
        "Asia": "Asie",
        "Africa": "Afrique",
        "SimpleMode": "Mode simple",
        "SatelliteMode": "Mode sattelite",
        "GodMode": "Mode DIEU",
        "LearnMode": "Mode d'apprentissage",
        "Settings": "Paramètres",
        "Wrong": "Faux:",
        "Click": "Cliquez sur:",
        "Restart": "Recommencer",
        "AllAnswered": "Tous répondu",
        "NextTask": "Tâche suivante",
        "Correct": "Correcte",
        "Congratulation": "Félicitation!"
    }
};

var settings;
var countryData;
var correctAnswers = [];
var filteredData;
var taskCountry;
var highlightFeature;
var wrongCounter = 0;
var wrongGuess = 0;
var correctCounter = 0;
var UNCODE = "wb_a3_2";
var godModeActivated = false;

var satLayer = new ol.layer.Tile({
    source: new ol.source.BingMaps({
        key: 'AmEVj-KGhoWve5_QCHdobhC-iOs1YMk07Q60Of4KRejgJ40Dv9jzm-ZJmCIYUuPz',
        imagerySet: "aerial"
    })
});

var vectorLayer = new ol.layer.Vector({
    updateWhileAnimating: true,
    updateWhileInteracting: true,
    source: new ol.source.Vector({
        loader: function() {
            var source = this;
            var format = new ol.format.TopoJSON();
            dojo.xhrGet({
                url: "data/countries_topojson.json",
                handleAs: "json",
                load: function(data) {
                    var features = format.readFeatures(data, {
                        featureProjection: 'EPSG:3857'
                    });
                    source.addFeatures(separateMultiPolygon(features));
                }
            });
        }
    }),
    style: function(feature) {
        return fillCountry(true);
    }
});

var map = new ol.Map({
    layers: [
        vectorLayer
    ],
    target: 'map',
    view: new ol.View({
        center: ol.proj.fromLonLat([19, 48]),
        extent: [-9999999999, -20920774, 99999999999, 18800987],
        zoom: 5,
        maxZoom: 11,
        minZoom: 3
    })
});

var overlayFeature = new ol.layer.Vector({
    source: new ol.source.Vector(),
    map: map,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'rgba(0,0,0,1)',
            width: 2
        }),
        fill: new ol.style.Fill({
            color: 'rgba(0,0,0,0.3)'
        })
    })
});

var correctAnswerFeature = new ol.layer.Vector({
    source: new ol.source.Vector(),
    map: map,
    style: new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(0, 255, 0, 0.5)'
        })
    })
});

var hintFeature = new ol.layer.Vector({
    source: new ol.source.Vector(),
    map: map,
    style: new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(0, 0, 255, 0.3)'
        }),
        stroke: new ol.style.Stroke({
            color: 'rgba(0, 0, 255, 1)',
            width: 2
        })
    })
});

function learnMode() {
    simpleMode();
    settings.learn = true;
}

function simpleMode() {
    settings.learn = false;
    vectorLayer.setStyle(fillCountry(true));
    if (map.getLayers().getArray().indexOf(vectorLayer) === -1) {
        map.getLayers().insertAt(1, vectorLayer);
    }
    map.removeLayer(satLayer);
    godModeActivated = false;
    dijit.byId('keepAnswer').set('checked', true);
}

function satMode() {
    settings.learn = false;
    vectorLayer.setStyle(fillCountry(false));
    if (map.getLayers().getArray().indexOf(vectorLayer) === -1) {
        map.getLayers().insertAt(1, vectorLayer);
    }
    if (map.getLayers().getArray().indexOf(satLayer) === -1) {
        map.getLayers().insertAt(0, satLayer);
    }
    godModeActivated = false;
    dijit.byId('keepAnswer').set('checked', true);
}

function godMode() {
    settings.learn = false;
    if (map.getLayers().getArray().indexOf(satLayer) === -1) {
        map.getLayers().insertAt(0, satLayer);
    }
    vectorLayer.setStyle(noStyle());
    godModeActivated = true;

    dojo.forEach(overlayFeature.getSource().getFeatures(), function(feature) {
        overlayFeature.getSource().removeFeature(feature);
    });

    dijit.byId('keepAnswer').set('checked', false);
}

function generateUUID() {
    var S4 = function() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

function separateMultiPolygon(features) {
    var result = [];
    dojo.forEach(features, function(feature) {
        var geom = feature.getGeometry();
        if (geom.getType() === 'MultiPolygon') {
            var mainFeature;
            var mainArea = 0;
            dojo.forEach(geom.getPolygons(), function(polygon) {
                if (polygon.getArea() > mainArea) {
                    var clone = feature.clone();
                    clone.setGeometry(polygon);
                    mainFeature = clone;
                    mainArea = polygon.getArea();
                }
            });

            mainFeature.childFeatures = [mainFeature];
            mainFeature.mainFeature = true;

            dojo.forEach(geom.getPolygons(), function(polygon) {
                if (polygon.getArea() !== mainArea) {
                    var clone = feature.clone();
                    clone.setGeometry(polygon);
                    clone.parentFeature = mainFeature;
                    clone.mainFeature = false;
                    clone.setId(generateUUID());
                    result.push(clone);
                    mainFeature.childFeatures.push(clone);
                }
            });

            result.push(mainFeature);
        } else {
            feature.mainFeature = true;
            feature.childFeatures = [feature];
            feature.setId(generateUUID());
            result.push(feature);
        }
    });

    return result;
}

function setLanguage(lang) {
    dojo.byId("langInput").value = lang;
    initSettings();
    localizeText();
}

function noStyle() {
    var s = new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(0, 0, 0, 0)'
        }),
        stroke: new ol.style.Stroke({
            color: 'rgba(0, 0, 0, 0)',
            width: 0.4
        })
    });
    return  s;
}

function fillCountry(simple) {
    var color = 'rgba(255, 255, 255, 0.2)';
    var stroke = 'rgba(255,255,255, 1)';
    if (simple) {
        color = '#FFF8E1';
        stroke = 'rgba(0,0,0, 1)';
    }
    var s = new ol.style.Style({
        fill: new ol.style.Fill({
            color: color
        }),
        stroke: new ol.style.Stroke({
            color: stroke,
            width: 0.4
        })
    });
    return  s;
}

function highlightFeatureInfo(pixel) {
    var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
        return feature;
    });

    if (feature !== highlightFeature) {
        if (highlightFeature && overlayFeature.getSource().getFeatures().length !== 0) {
            overlayFeature.getSource().removeFeature(highlightFeature);
        }
        if (feature) {
            overlayFeature.getSource().addFeature(feature);
        } else {
        }
        highlightFeature = feature;
    }
}

function nameHintLayer(feature) {
    var countryName = "";
    if (feature) {
        var country = findCountry(feature);
        if (country.name.translations[settings.lang]) {
            countryName = country.name.translations[settings.lang];
        } else {
            countryName = country.name.common;
        }
    }

    var nameLayer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        map: map,
        style: new ol.style.Style({
            text: new ol.style.Text({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 1)'
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 0, 0, 1)'
                }),
                text: countryName,
                font: '20px sans-serif'
            })
        })
    });
    return nameLayer;
}

function getWrongVectorLayer() {
    var vLayer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        map: map,
        style: new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(255, 0, 0, 0.5)'
            })
        })
    });
    return vLayer;
}

function findCountry(feature) {
    var result;
    dojo.forEach(countryData.features, function(country) {
        if (feature.get(UNCODE) === country.ccn3) {
            result = country;
        }
    });
    return result;
}

function checkCorrectAnswer(pixel) {
    var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
        return feature;
    });

    if (!feature.mainFeature) {
        feature = feature.parentFeature;
    }

    if (feature && correctAnswers.indexOf(feature.get(UNCODE)) !== -1) {
        wrongAnswer(feature, pixel);
        return;
    }

    if (taskCountry && feature && feature.get(UNCODE) === taskCountry.ccn3) {
        clearHintFeature();
        var fill = correctAnswerFeature.getStyle().getFill();
        var keepHighlight = settings.keepAnswer.length === 0;

        dojo.forEach(feature.childFeatures, function(childFeature) {
            correctAnswerFeature.getSource().addFeature(childFeature);
            if (keepHighlight) {
                correctAnswerAnimate(fill, childFeature);
            }
        });

        correctAnswers.push(taskCountry.ccn3);
        countAnswer(true);
        initializeTask();
        wrongGuess = 0;
    } else if (feature) {
        wrongAnswer(feature, pixel);
    }
}

function wrongAnswer(feature, pixel) {
    var nameLayer;
    var cFeature;
    var wrongAnswerFeature = getWrongVectorLayer();

    dojo.forEach(feature.childFeatures, function(childFeature) {
        wrongAnswerFeature.getSource().addFeature(childFeature);
    });
    if (settings.learn) {
        nameLayer = nameHintLayer(feature);

        var coor = map.getCoordinateFromPixel(pixel);
        var circle = new ol.geom.Circle(coor, 1, 'XY');
        cFeature = new ol.Feature({geometry: circle});

        nameLayer.getSource().addFeature(cFeature);
    }
    wrongAnswerAnimate(wrongAnswerFeature, nameLayer, feature.childFeatures, cFeature);
    countAnswer(false);
    wrongGuess++;
    if (settings.hint.length > 0 && wrongGuess >= settings.guessCount) {
        showHintFeature();
    }
}

function clearHintFeature() {
    var featureArray = hintFeature.getSource().getFeatures();
    dojo.forEach(featureArray, function(feature) {
        hintFeature.getSource().removeFeature(feature);
    });
}


function restart() {
    var vectorSource = correctAnswerFeature.getSource();
    dojo.forEach(vectorSource.getFeatures(), function(feature) {
        vectorSource.removeFeature(feature);
    });
    clearHintFeature();
    correctAnswers = [];
    resetCounter();
    filterDataByCriteria();
}

function nextTask() {
    initializeTask();
}

function destroyLayer(layer) {
    if (layer) {
        map.removeLayer(layer);
        layer = null;
    }
}

map.on('pointermove', function(evt) {
    if (evt.dragging) {
        return;
    }
    if (!godModeActivated) {
        var pixel = map.getEventPixel(evt.originalEvent);
        highlightFeatureInfo(pixel);
    }
});

map.on('click', function(evt) {
    checkCorrectAnswer(evt.pixel);
});