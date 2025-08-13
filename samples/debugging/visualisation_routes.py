import numpy as np
from datetime import datetime, date
import plotly.graph_objects as go

def get_plotting_zoom_level_and_center_coordinates_from_lonlat_tuples(longitudes=None, latitudes=None):

    if ((latitudes is None or longitudes is None)
            or (len(latitudes) != len(longitudes))):
        return 0, (0, 0)

    b_box = {}
    b_box['height'] = max(latitudes)-min(latitudes)
    b_box['width'] = max(longitudes)-min(longitudes)
    b_box['center']= (np.mean(longitudes), np.mean(latitudes))

    area = b_box['height'] * b_box['width']

    zoom = np.interp(x=area,
                     xp=[0, 5**-10, 4**-10, 3**-10, 2**-10, 1**-10, 1**-5],
                     fp=[20, 15,    14,     13,     12,     7,      5])

    return zoom, b_box['center']


def plot_some_points(latitudes, longitudes, hover=None, starts=None, text=None, lines=False, marker_colors=None):
    print(None if text is None else 'bottom right',)
    fig = go.Figure(go.Scattermapbox(
    mode = "markers" if lines is False else "markers+lines",
    lon = longitudes,
    lat = latitudes,
    hovertext=hover,
    marker = {'size': 20, 'color': marker_colors},
    name='Logs',
    text=text,
    textfont=dict(size=12, color='red'),
    textposition=None if text is None else 'bottom right',
    showlegend=False
    ))
    fig.add_trace(go.Scattermapbox(
        lon=[None], lat=[None],
        mode='markers',
        marker=dict(size=10, color='red'),
        name='End',
        showlegend=True
    ))

    fig.add_trace(go.Scattermapbox(
        lon=[None], lat=[None],
        mode='markers',
        marker=dict(size=10, color='blue'),
        name='Start',
        showlegend=True
    ))
    z, (h, w) = get_plotting_zoom_level_and_center_coordinates_from_lonlat_tuples(longitudes, latitudes)
    if starts is not None:
        fig.add_scattermapbox(
            mode="markers",
            lon=starts.longitude,
            lat=starts.latitude,
            hovertext=[f"{st.id} {st.address}" for st in starts.itertuples()],
            marker={'size': 20, 'color': '#f00'}
        )
    fig.update_layout(mapbox_style="open-street-map")
    fig.update_layout(margin={"r":0,"t":0,"l":0,"b":0})
    fig.update_layout(mapbox={'zoom': z, "center": {'lon': h, 'lat': w}})
    return fig


def visualise_mileagebook_logs(trips, also_ends=False):
    from fleetmanager.extractors.mileagebook.updatedb import format_trip_logs
    trips = format_trip_logs(trips)
    # trips = [a for a in trips if a.get("start_time") > datetime(2024, 9, 17) and a.get("end_time") < datetime(2024,9,19)]
    if also_ends:
        # hover = [(k, a["start_time"], a["distance"]) for k, a in enumerate(trips)] + [
        #     (len(trips) + 1, trips[-1]["end_time"])]
        hover = None
        latitudes = [a for b in trips for a in [b["start_latitude"], b["end_latitude"]]]
        longitudes = [a for b in trips for a in [b["start_longitude"], b["end_longitude"]]]
        hover = [(k, start_or_end, trip["start_time"] if start_or_end == "start" else trip["end_time"]) for k, trip in enumerate(trips) for start_or_end in ["start", "end"]]
        colors = [color for trip in trips for color in ["blue", "red"]]
    else:
        colors = None
        hover = [(k, a["start_time"], a["distance"]) for k, a in enumerate(trips)] + [
            (len(trips) + 1, trips[-1]["end_time"])]
        latitudes = [a["start_latitude"] for a in trips] + [trips[-1]["end_latitude"]]
        longitudes = [a["start_longitude"] for a in trips] + [trips[-1]["end_longitude"]]

    fig = plot_some_points(latitudes, longitudes, lines=False, hover=hover, marker_colors=colors)
    fig.show()


if __name__ == '__main__':
    import json
    path = ""
    trips = json.load(open(path))
    visualise_mileagebook_logs(trips, also_ends=True)
